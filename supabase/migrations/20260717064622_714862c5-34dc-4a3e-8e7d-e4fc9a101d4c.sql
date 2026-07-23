
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf TEXT NOT NULL UNIQUE,
  nome_completo TEXT NOT NULL,
  telefone TEXT, email TEXT, tatuador TEXT,
  dados_cadastrais JSONB NOT NULL DEFAULT '{}'::jsonb,
  anamnese JSONB NOT NULL DEFAULT '{}'::jsonb,
  assinatura TEXT,
  sessoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'aguardando',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  anamnese_enc bytea
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT INSERT ON public.clientes TO anon;
GRANT ALL ON public.clientes TO service_role;
CREATE INDEX clientes_criado_em_idx ON public.clientes (criado_em DESC);
CREATE INDEX clientes_tatuador_idx ON public.clientes (tatuador);

CREATE OR REPLACE FUNCTION public.tg_set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$ BEGIN NEW.atualizado_em = now(); RETURN NEW; END; $$;
CREATE TRIGGER clientes_set_atualizado_em BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admins (
  user_id UUID PRIMARY KEY,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admins TO authenticated;
GRANT ALL ON public.admins TO service_role;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()); $$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE POLICY "Admin reads self" ON public.admins
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Public check-in insert" ON public.clientes
  FOR INSERT TO anon, authenticated
  WITH CHECK (cpf ~ '^[0-9]{11}$' AND length(nome_completo) BETWEEN 2 AND 200 AND status = 'aguardando');
CREATE POLICY "Admins read clientes" ON public.clientes FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins update clientes" ON public.clientes FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete clientes" ON public.clientes FOR DELETE TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.tg_validate_cliente()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE is_anon boolean := (auth.uid() IS NULL);
BEGIN
  NEW.cpf := regexp_replace(coalesce(NEW.cpf, ''), '\D', '', 'g');
  IF NEW.cpf !~ '^[0-9]{11}$' THEN RAISE EXCEPTION 'CPF inválido'; END IF;
  NEW.nome_completo := btrim(coalesce(NEW.nome_completo, ''));
  IF length(NEW.nome_completo) < 2 OR length(NEW.nome_completo) > 200 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
  IF NEW.telefone IS NOT NULL AND length(NEW.telefone) > 32 THEN RAISE EXCEPTION 'Telefone longo'; END IF;
  IF NEW.email IS NOT NULL AND length(NEW.email) > 254 THEN RAISE EXCEPTION 'E-mail longo'; END IF;
  IF NEW.tatuador IS NOT NULL AND length(NEW.tatuador) > 120 THEN RAISE EXCEPTION 'Tatuador inválido'; END IF;
  IF pg_column_size(NEW.dados_cadastrais) > 16384 THEN RAISE EXCEPTION 'dados grandes'; END IF;
  IF pg_column_size(NEW.anamnese) > 16384 THEN RAISE EXCEPTION 'anamnese grande'; END IF;
  IF pg_column_size(NEW.sessoes) > 20971520 THEN RAISE EXCEPTION 'sessoes grandes'; END IF;
  IF NEW.assinatura IS NOT NULL AND length(NEW.assinatura) > 2000000 THEN RAISE EXCEPTION 'assinatura grande'; END IF;
  IF is_anon THEN NEW.status := 'aguardando'; NEW.criado_em := now(); NEW.atualizado_em := now(); END IF;
  IF NEW.status NOT IN ('aguardando','atendido') THEN RAISE EXCEPTION 'Status inválido'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER validate_cliente_biu BEFORE INSERT OR UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.tg_validate_cliente();

-- Storage policies (bucket já criado)
CREATE POLICY "Public upload assinatura" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'assinaturas'
    AND lower(storage.extension(name)) IN ('png','jpg','jpeg','webp')
    AND octet_length(coalesce(name,'')) <= 256);
CREATE POLICY "Admins read assinaturas" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'assinaturas' AND public.is_admin());
CREATE POLICY "Admins update assinaturas" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'assinaturas' AND public.is_admin());
CREATE POLICY "Admins delete assinaturas" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'assinaturas' AND public.is_admin());

-- RPCs
CREATE OR REPLACE FUNCTION public.checkin_get_cliente(_cpf text)
RETURNS TABLE (cpf text, nome_completo text, tatuador text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.cpf, c.nome_completo, c.tatuador FROM public.clientes c
  WHERE c.cpf = regexp_replace(coalesce(_cpf,''),'\D','','g') LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.checkin_get_cliente(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.checkin_append_sessao(
  _cpf text, _sessao jsonb, _anamnese jsonb DEFAULT NULL, _tatuador text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cpf_d text := regexp_replace(coalesce(_cpf,''),'\D','','g');
BEGIN
  IF octet_length(coalesce(_sessao::text,'')) > 1048576 THEN RAISE EXCEPTION 'Sessão grande'; END IF;
  UPDATE public.clientes SET
    sessoes = coalesce(sessoes,'[]'::jsonb) || coalesce(_sessao,'{}'::jsonb),
    tatuador = COALESCE(NULLIF(trim(_tatuador),''), tatuador),
    dados_cadastrais = CASE WHEN NULLIF(trim(_tatuador),'') IS NOT NULL
      THEN jsonb_set(coalesce(dados_cadastrais,'{}'::jsonb),'{tatuador}',to_jsonb(trim(_tatuador)))
      ELSE dados_cadastrais END,
    atualizado_em = now()
  WHERE cpf = cpf_d;
  IF NOT FOUND THEN RAISE EXCEPTION 'cliente não encontrado'; END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.checkin_append_sessao(text,jsonb,jsonb,text) TO anon, authenticated;

-- LGPD
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.consent_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf text NOT NULL, tipo text NOT NULL, versao text NOT NULL DEFAULT 'v1',
  texto_hash text NOT NULL, ip text, user_agent text,
  device jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.consent_records TO anon, authenticated;
GRANT SELECT ON public.consent_records TO authenticated;
GRANT ALL ON public.consent_records TO service_role;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public consent insert" ON public.consent_records FOR INSERT TO anon, authenticated
  WITH CHECK (cpf ~ '^[0-9]{11}$' AND tipo IN ('lgpd','termo','anamnese') AND length(texto_hash) BETWEEN 8 AND 128);
CREATE POLICY "Admins read consent" ON public.consent_records FOR SELECT TO authenticated USING (public.is_admin());

CREATE TABLE public.admin_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL, acao text NOT NULL, cliente_cpf text,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb, ip text, user_agent text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit" ON public.admin_audit_log FOR SELECT TO authenticated USING (public.is_admin());

CREATE TABLE public.data_subject_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf text NOT NULL, email text, tipo text NOT NULL, motivo text,
  status text NOT NULL DEFAULT 'pendente', resposta text,
  ip text, user_agent text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz, resolvido_por uuid
);
GRANT INSERT ON public.data_subject_requests TO anon, authenticated;
GRANT SELECT, UPDATE ON public.data_subject_requests TO authenticated;
GRANT ALL ON public.data_subject_requests TO service_role;
ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public DSR insert" ON public.data_subject_requests FOR INSERT TO anon, authenticated
  WITH CHECK (cpf ~ '^[0-9]{11}$' AND tipo IN ('delete','anonymize','export','rectify') AND status='pendente');
CREATE POLICY "Admins read DSR" ON public.data_subject_requests FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins update DSR" ON public.data_subject_requests FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.rate_limit_buckets (
  bucket_key text NOT NULL, window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);
GRANT ALL ON public.rate_limit_buckets TO service_role;
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all" ON public.rate_limit_buckets FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.registrar_consentimento(
  _cpf text, _tipo text, _texto_hash text, _versao text DEFAULT 'v1',
  _ip text DEFAULT NULL, _user_agent text DEFAULT NULL, _device jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d text := regexp_replace(coalesce(_cpf,''),'\D','','g'); new_id uuid;
BEGIN
  IF d !~ '^[0-9]{11}$' THEN RAISE EXCEPTION 'CPF inválido'; END IF;
  IF _tipo NOT IN ('lgpd','termo','anamnese') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
  INSERT INTO public.consent_records(cpf, tipo, versao, texto_hash, ip, user_agent, device)
  VALUES (d, _tipo, coalesce(_versao,'v1'), _texto_hash,
    left(coalesce(_ip,''),64), left(coalesce(_user_agent,''),1024), coalesce(_device,'{}'::jsonb))
  RETURNING id INTO new_id;
  RETURN new_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.registrar_consentimento(text,text,text,text,text,text,jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.rate_limit_check(_key text, _max int, _window_seconds int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE win_start timestamptz; cur_count int;
BEGIN
  IF _key IS NULL OR length(_key)=0 OR length(_key)>200 THEN RAISE EXCEPTION 'Chave inválida'; END IF;
  IF _max<=0 OR _max>10000 THEN RAISE EXCEPTION 'Limite inválido'; END IF;
  IF _window_seconds<=0 OR _window_seconds>86400 THEN RAISE EXCEPTION 'Janela inválida'; END IF;
  win_start := date_trunc('second', now()) - (extract(epoch from now())::bigint % _window_seconds) * interval '1 second';
  DELETE FROM public.rate_limit_buckets WHERE window_start < now() - interval '1 day';
  INSERT INTO public.rate_limit_buckets(bucket_key, window_start, count) VALUES (_key, win_start, 1)
  ON CONFLICT (bucket_key, window_start) DO UPDATE SET count = public.rate_limit_buckets.count + 1
  RETURNING count INTO cur_count;
  RETURN cur_count <= _max;
END; $$;
GRANT EXECUTE ON FUNCTION public.rate_limit_check(text,int,int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_admin_action(
  _acao text, _cliente_cpf text DEFAULT NULL, _detalhes jsonb DEFAULT '{}'::jsonb,
  _ip text DEFAULT NULL, _user_agent text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  IF _acao NOT IN ('view_cliente','edit_cliente','export','delete','anonymize','unmask','login','dsr_resolve') THEN
    RAISE EXCEPTION 'Ação inválida';
  END IF;
  INSERT INTO public.admin_audit_log(admin_id, acao, cliente_cpf, detalhes, ip, user_agent)
  VALUES (uid, _acao, NULLIF(regexp_replace(coalesce(_cliente_cpf,''),'\D','','g'),''),
    coalesce(_detalhes,'{}'::jsonb), left(coalesce(_ip,''),64), left(coalesce(_user_agent,''),1024))
  RETURNING id INTO new_id;
  RETURN new_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text,text,jsonb,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.anonymize_cliente(_cpf text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d text := regexp_replace(coalesce(_cpf,''),'\D','','g'); hashed text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  IF d !~ '^[0-9]{11}$' THEN RAISE EXCEPTION 'CPF inválido'; END IF;
  hashed := encode(digest('lgpd:'||d,'sha256'),'hex');
  UPDATE public.clientes SET nome_completo='Titular Anonimizado', telefone=NULL, email=NULL,
    dados_cadastrais=jsonb_build_object('anonimizado',true,'anonimizadoEm',to_jsonb(now()),'cpfHash',to_jsonb(hashed)),
    anamnese='{}'::jsonb, anamnese_enc=NULL, assinatura=NULL, sessoes='[]'::jsonb, status='atendido', atualizado_em=now()
  WHERE cpf=d;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  INSERT INTO public.admin_audit_log(admin_id, acao, cliente_cpf, detalhes)
  VALUES (auth.uid(),'anonymize',d,jsonb_build_object('cpfHash',hashed));
END; $$;
GRANT EXECUTE ON FUNCTION public.anonymize_cliente(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_cliente_lgpd(_cpf text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d text := regexp_replace(coalesce(_cpf,''),'\D','','g');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  IF d !~ '^[0-9]{11}$' THEN RAISE EXCEPTION 'CPF inválido'; END IF;
  INSERT INTO public.admin_audit_log(admin_id, acao, cliente_cpf, detalhes)
  VALUES (auth.uid(),'delete',d,jsonb_build_object('motivo','lgpd'));
  DELETE FROM public.clientes WHERE cpf=d;
END; $$;
GRANT EXECUTE ON FUNCTION public.delete_cliente_lgpd(text) TO authenticated;

CREATE TABLE public.app_config (
  key TEXT PRIMARY KEY, value TEXT, atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins app_config select" ON public.app_config FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins app_config insert" ON public.app_config FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins app_config update" ON public.app_config FOR UPDATE TO authenticated USING (public.is_admin());

CREATE TABLE public.backup_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status text NOT NULL, mensagem text, spreadsheet_id text, spreadsheet_url text,
  csv_tab text, total_clientes int, duracao_ms int,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.backup_logs TO authenticated;
GRANT ALL ON public.backup_logs TO service_role;
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read backup_logs" ON public.backup_logs FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.latest_backup_status()
RETURNS TABLE(status text, mensagem text, iniciado_em timestamptz, concluido_em timestamptz,
  spreadsheet_url text, total_clientes int, duracao_ms int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT status, mensagem, iniciado_em, concluido_em, spreadsheet_url, total_clientes, duracao_ms
  FROM public.backup_logs ORDER BY iniciado_em DESC LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.latest_backup_status() TO authenticated;

CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text, ip text, user_agent text,
  success boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_email_idx ON public.login_attempts(email, criado_em DESC);
CREATE INDEX login_attempts_ip_idx ON public.login_attempts(ip, criado_em DESC);
GRANT SELECT ON public.login_attempts TO authenticated;
GRANT ALL ON public.login_attempts TO service_role;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read login_attempts" ON public.login_attempts FOR SELECT TO authenticated USING (public.is_admin());

CREATE TABLE public.abuse_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rota text, ip text, motivo text NOT NULL,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb, user_agent text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.abuse_logs TO authenticated;
GRANT ALL ON public.abuse_logs TO service_role;
ALTER TABLE public.abuse_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read abuse_logs" ON public.abuse_logs FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.check_login_lockout(_email text, _ip text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e text := lower(btrim(coalesce(_email,''))); ip_v text := left(coalesce(_ip,''),64);
  fails_email int; fails_ip int; last_fail timestamptz; locked_until timestamptz;
BEGIN
  SELECT count(*) INTO fails_ip FROM public.login_attempts
    WHERE ip=ip_v AND success=false AND criado_em > now() - interval '1 minute';
  IF fails_ip >= 5 THEN
    RETURN jsonb_build_object('locked',true,'reason','rate_limit_ip','retry_after_seconds',60);
  END IF;
  SELECT count(*), max(criado_em) INTO fails_email, last_fail FROM public.login_attempts
    WHERE email=e AND criado_em > now() - interval '15 minutes'
    AND criado_em > coalesce((SELECT max(criado_em) FROM public.login_attempts WHERE email=e AND success=true),'epoch'::timestamptz);
  IF fails_email >= 5 THEN
    locked_until := last_fail + interval '15 minutes';
    IF locked_until > now() THEN
      RETURN jsonb_build_object('locked',true,'reason','lockout_email',
        'retry_after_seconds', greatest(1, extract(epoch from locked_until - now())::int));
    END IF;
  END IF;
  RETURN jsonb_build_object('locked',false);
END; $$;
GRANT EXECUTE ON FUNCTION public.check_login_lockout(text,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_login_attempt(_email text, _ip text, _success boolean, _user_agent text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.login_attempts(email, ip, user_agent, success)
  VALUES (lower(btrim(coalesce(_email,''))), left(coalesce(_ip,''),64),
    left(coalesce(_user_agent,''),1024), coalesce(_success,false));
  DELETE FROM public.login_attempts WHERE criado_em < now() - interval '7 days';
END; $$;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(text,text,boolean,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_abuse(_rota text, _ip text, _motivo text, _detalhes jsonb DEFAULT '{}'::jsonb, _user_agent text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF _motivo IS NULL OR length(_motivo)=0 OR length(_motivo)>80 THEN RAISE EXCEPTION 'Motivo inválido'; END IF;
  INSERT INTO public.abuse_logs(rota, ip, motivo, detalhes, user_agent)
  VALUES (left(coalesce(_rota,''),200), left(coalesce(_ip,''),64), _motivo,
    coalesce(_detalhes,'{}'::jsonb), left(coalesce(_user_agent,''),1024))
  RETURNING id INTO new_id;
  DELETE FROM public.abuse_logs WHERE criado_em < now() - interval '30 days';
  RETURN new_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.record_abuse(text,text,text,jsonb,text) TO anon, authenticated;
