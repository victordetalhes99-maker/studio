
-- 1) login_attempts
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  ip text,
  user_agent text,
  success boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_email_idx ON public.login_attempts(email, criado_em DESC);
CREATE INDEX IF NOT EXISTS login_attempts_ip_idx ON public.login_attempts(ip, criado_em DESC);

GRANT SELECT ON public.login_attempts TO authenticated;
GRANT ALL ON public.login_attempts TO service_role;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read login_attempts" ON public.login_attempts
  FOR SELECT TO authenticated USING (public.is_admin());

-- 2) abuse_logs
CREATE TABLE IF NOT EXISTS public.abuse_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rota text,
  ip text,
  motivo text NOT NULL,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS abuse_logs_criado_idx ON public.abuse_logs(criado_em DESC);
CREATE INDEX IF NOT EXISTS abuse_logs_ip_idx ON public.abuse_logs(ip, criado_em DESC);

GRANT SELECT ON public.abuse_logs TO authenticated;
GRANT ALL ON public.abuse_logs TO service_role;
ALTER TABLE public.abuse_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read abuse_logs" ON public.abuse_logs
  FOR SELECT TO authenticated USING (public.is_admin());

-- 3) Verifica lockout (5 falhas consecutivas em 15 min => bloqueia por 15 min)
CREATE OR REPLACE FUNCTION public.check_login_lockout(_email text, _ip text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e text := lower(btrim(coalesce(_email, '')));
  ip text := left(coalesce(_ip, ''), 64);
  fails_email int;
  fails_ip int;
  last_fail timestamptz;
  locked_until timestamptz;
BEGIN
  -- Falhas no último minuto por IP (limite 5/min)
  SELECT count(*) INTO fails_ip
    FROM public.login_attempts
   WHERE ip = ip AND success = false
     AND criado_em > now() - interval '1 minute';

  IF fails_ip >= 5 THEN
    INSERT INTO public.abuse_logs(rota, ip, motivo, detalhes)
    VALUES ('/admin/login', ip, 'rate_limit_ip', jsonb_build_object('fails_last_minute', fails_ip));
    RETURN jsonb_build_object('locked', true, 'reason', 'rate_limit_ip',
                              'retry_after_seconds', 60);
  END IF;

  -- Falhas consecutivas por e-mail (sem sucesso intercalado) nos últimos 15 min
  SELECT count(*), max(criado_em) INTO fails_email, last_fail
    FROM public.login_attempts
   WHERE email = e
     AND criado_em > now() - interval '15 minutes'
     AND criado_em > coalesce((
        SELECT max(criado_em) FROM public.login_attempts
         WHERE email = e AND success = true
     ), 'epoch'::timestamptz);

  IF fails_email >= 5 THEN
    locked_until := last_fail + interval '15 minutes';
    IF locked_until > now() THEN
      INSERT INTO public.abuse_logs(rota, ip, motivo, detalhes)
      VALUES ('/admin/login', ip, 'lockout_email',
              jsonb_build_object('email', e, 'fails', fails_email, 'until', to_jsonb(locked_until)));
      RETURN jsonb_build_object('locked', true, 'reason', 'lockout_email',
                                'retry_after_seconds',
                                greatest(1, extract(epoch from locked_until - now())::int));
    END IF;
  END IF;

  RETURN jsonb_build_object('locked', false);
END;
$$;
REVOKE ALL ON FUNCTION public.check_login_lockout(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_login_lockout(text, text) TO anon, authenticated;

-- 4) Registrar tentativa de login
CREATE OR REPLACE FUNCTION public.record_login_attempt(_email text, _ip text, _success boolean, _user_agent text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.login_attempts(email, ip, user_agent, success)
  VALUES (lower(btrim(coalesce(_email, ''))),
          left(coalesce(_ip, ''), 64),
          left(coalesce(_user_agent, ''), 1024),
          coalesce(_success, false));

  -- Limpeza oportunista: registros > 7 dias
  DELETE FROM public.login_attempts WHERE criado_em < now() - interval '7 days';
END;
$$;
REVOKE ALL ON FUNCTION public.record_login_attempt(text, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(text, text, boolean, text) TO anon, authenticated;

-- 5) Registrar abuso genérico
CREATE OR REPLACE FUNCTION public.record_abuse(_rota text, _ip text, _motivo text, _detalhes jsonb DEFAULT '{}'::jsonb, _user_agent text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id uuid;
BEGIN
  IF _motivo IS NULL OR length(_motivo) = 0 OR length(_motivo) > 80 THEN
    RAISE EXCEPTION 'Motivo inválido';
  END IF;

  INSERT INTO public.abuse_logs(rota, ip, motivo, detalhes, user_agent)
  VALUES (left(coalesce(_rota, ''), 200),
          left(coalesce(_ip, ''), 64),
          _motivo,
          coalesce(_detalhes, '{}'::jsonb),
          left(coalesce(_user_agent, ''), 1024))
  RETURNING id INTO new_id;

  -- Limpeza oportunista: registros > 30 dias
  DELETE FROM public.abuse_logs WHERE criado_em < now() - interval '30 days';
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_abuse(text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_abuse(text, text, text, jsonb, text) TO anon, authenticated;
