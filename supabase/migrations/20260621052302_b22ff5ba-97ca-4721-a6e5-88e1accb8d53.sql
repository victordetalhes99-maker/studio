
-- Extensão para criptografia / hash
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1) consent_records — prova de consentimento (LGPD art. 8º)
-- ============================================================
CREATE TABLE public.consent_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf text NOT NULL,
  tipo text NOT NULL,          -- 'lgpd' | 'termo' | 'anamnese'
  versao text NOT NULL DEFAULT 'v1',
  texto_hash text NOT NULL,    -- sha256 do texto exato aceito
  ip text,
  user_agent text,
  device jsonb NOT NULL DEFAULT '{}'::jsonb, -- { platform, lang, tz, screen }
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX consent_records_cpf_idx ON public.consent_records(cpf);
CREATE INDEX consent_records_criado_em_idx ON public.consent_records(criado_em DESC);

GRANT INSERT ON public.consent_records TO anon, authenticated;
GRANT SELECT ON public.consent_records TO authenticated;
GRANT ALL ON public.consent_records TO service_role;

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

-- Insert público validado (kiosk anônimo)
CREATE POLICY "Public consent insert (validated)"
  ON public.consent_records FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    cpf ~ '^[0-9]{11}$'
    AND tipo IN ('lgpd', 'termo', 'anamnese')
    AND length(texto_hash) BETWEEN 8 AND 128
    AND coalesce(length(user_agent), 0) <= 1024
    AND coalesce(length(ip), 0) <= 64
    AND pg_column_size(device) <= 4096
  );

-- Só admin lê
CREATE POLICY "Admins read consent"
  ON public.consent_records FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 2) admin_audit_log — auditoria de ações do admin
-- ============================================================
CREATE TABLE public.admin_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL,
  acao text NOT NULL,                -- 'view_cliente' | 'edit_cliente' | 'export' | 'delete' | 'anonymize' | 'unmask'
  cliente_cpf text,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_audit_log_admin_idx ON public.admin_audit_log(admin_id, criado_em DESC);
CREATE INDEX admin_audit_log_cpf_idx ON public.admin_audit_log(cliente_cpf, criado_em DESC);

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Insert é só via função SECURITY DEFINER (sem policy para INSERT)

-- ============================================================
-- 3) data_subject_requests — pedidos LGPD do titular
-- ============================================================
CREATE TABLE public.data_subject_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf text NOT NULL,
  email text,
  tipo text NOT NULL,                -- 'delete' | 'anonymize' | 'export' | 'rectify'
  motivo text,
  status text NOT NULL DEFAULT 'pendente', -- 'pendente' | 'em_analise' | 'concluido' | 'negado'
  resposta text,
  ip text,
  user_agent text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  resolvido_por uuid
);

CREATE INDEX dsr_status_idx ON public.data_subject_requests(status, criado_em DESC);
CREATE INDEX dsr_cpf_idx ON public.data_subject_requests(cpf);

GRANT INSERT ON public.data_subject_requests TO anon, authenticated;
GRANT SELECT, UPDATE ON public.data_subject_requests TO authenticated;
GRANT ALL ON public.data_subject_requests TO service_role;

ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public DSR insert (validated)"
  ON public.data_subject_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    cpf ~ '^[0-9]{11}$'
    AND tipo IN ('delete', 'anonymize', 'export', 'rectify')
    AND status = 'pendente'
    AND coalesce(length(email), 0) <= 254
    AND coalesce(length(motivo), 0) <= 2000
    AND coalesce(length(user_agent), 0) <= 1024
  );

CREATE POLICY "Admins read DSR"
  ON public.data_subject_requests FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins update DSR"
  ON public.data_subject_requests FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- 4) rate_limit_buckets — token bucket por chave (IP, CPF, etc.)
-- ============================================================
CREATE TABLE public.rate_limit_buckets (
  bucket_key text NOT NULL,           -- ex: 'ip:1.2.3.4:checkin', 'cpf:123:checkin'
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX rate_limit_window_idx ON public.rate_limit_buckets(window_start);

GRANT ALL ON public.rate_limit_buckets TO service_role;

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
-- Sem policies = só service_role / SECURITY DEFINER acessa

-- ============================================================
-- 5) clientes.anamnese_enc — preparação para criptografia
-- ============================================================
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS anamnese_enc bytea;

-- ============================================================
-- 6) FUNÇÕES SECURITY DEFINER
-- ============================================================

-- 6.1) Registro de consentimento (chamado via RPC pelo kiosk anônimo)
CREATE OR REPLACE FUNCTION public.registrar_consentimento(
  _cpf text,
  _tipo text,
  _texto_hash text,
  _versao text DEFAULT 'v1',
  _ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _device jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  new_id uuid;
BEGIN
  IF d !~ '^[0-9]{11}$' THEN
    RAISE EXCEPTION 'CPF inválido';
  END IF;
  IF _tipo NOT IN ('lgpd', 'termo', 'anamnese') THEN
    RAISE EXCEPTION 'Tipo de consentimento inválido';
  END IF;
  IF _texto_hash IS NULL OR length(_texto_hash) < 8 OR length(_texto_hash) > 128 THEN
    RAISE EXCEPTION 'Hash do texto inválido';
  END IF;

  INSERT INTO public.consent_records(cpf, tipo, versao, texto_hash, ip, user_agent, device)
  VALUES (d, _tipo, coalesce(_versao, 'v1'), _texto_hash,
          left(coalesce(_ip, ''), 64),
          left(coalesce(_user_agent, ''), 1024),
          coalesce(_device, '{}'::jsonb))
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_consentimento(text, text, text, text, text, text, jsonb)
  TO anon, authenticated;

-- 6.2) Rate limit check (SECURITY DEFINER — anônimo pode chamar via RPC)
-- Janela de tamanho fixo. Retorna true se permitido (e incrementa), false se excedeu.
CREATE OR REPLACE FUNCTION public.rate_limit_check(
  _key text,
  _max int,
  _window_seconds int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  win_start timestamptz;
  cur_count int;
BEGIN
  IF _key IS NULL OR length(_key) = 0 OR length(_key) > 200 THEN
    RAISE EXCEPTION 'Chave inválida';
  END IF;
  IF _max <= 0 OR _max > 10000 THEN
    RAISE EXCEPTION 'Limite inválido';
  END IF;
  IF _window_seconds <= 0 OR _window_seconds > 86400 THEN
    RAISE EXCEPTION 'Janela inválida';
  END IF;

  win_start := date_trunc('second', now()) - (extract(epoch from now())::bigint % _window_seconds) * interval '1 second';

  -- Limpa janelas antigas oportunisticamente
  DELETE FROM public.rate_limit_buckets
   WHERE window_start < now() - interval '1 day';

  INSERT INTO public.rate_limit_buckets(bucket_key, window_start, count)
  VALUES (_key, win_start, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET count = public.rate_limit_buckets.count + 1
  RETURNING count INTO cur_count;

  RETURN cur_count <= _max;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rate_limit_check(text, int, int) TO anon, authenticated;

-- 6.3) Logging admin (apenas admin)
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _acao text,
  _cliente_cpf text DEFAULT NULL,
  _detalhes jsonb DEFAULT '{}'::jsonb,
  _ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;
  IF _acao NOT IN ('view_cliente','edit_cliente','export','delete','anonymize','unmask','login','dsr_resolve') THEN
    RAISE EXCEPTION 'Ação inválida';
  END IF;

  INSERT INTO public.admin_audit_log(admin_id, acao, cliente_cpf, detalhes, ip, user_agent)
  VALUES (uid, _acao,
          NULLIF(regexp_replace(coalesce(_cliente_cpf, ''), '\D', '', 'g'), ''),
          coalesce(_detalhes, '{}'::jsonb),
          left(coalesce(_ip, ''), 64),
          left(coalesce(_user_agent, ''), 1024))
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, jsonb, text, text) TO authenticated;

-- 6.4) Anonimização de cliente (atendendo direito do titular)
CREATE OR REPLACE FUNCTION public.anonymize_cliente(_cpf text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  hashed text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;
  IF d !~ '^[0-9]{11}$' THEN
    RAISE EXCEPTION 'CPF inválido';
  END IF;

  hashed := encode(digest('lgpd:' || d, 'sha256'), 'hex');

  UPDATE public.clientes
     SET nome_completo  = 'Titular Anonimizado',
         telefone       = NULL,
         email          = NULL,
         tatuador       = tatuador, -- preserva para estatística
         dados_cadastrais = jsonb_build_object(
            'anonimizado', true,
            'anonimizadoEm', to_jsonb(now()),
            'cpfHash', to_jsonb(hashed)
         ),
         anamnese       = '{}'::jsonb,
         anamnese_enc   = NULL,
         assinatura     = NULL,
         sessoes        = '[]'::jsonb,
         status         = 'atendido',
         atualizado_em  = now()
   WHERE cpf = d;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;

  -- Registro de auditoria
  INSERT INTO public.admin_audit_log(admin_id, acao, cliente_cpf, detalhes)
  VALUES (auth.uid(), 'anonymize', d, jsonb_build_object('cpfHash', hashed));
END;
$$;

GRANT EXECUTE ON FUNCTION public.anonymize_cliente(text) TO authenticated;

-- 6.5) Apagar cliente totalmente (direito ao esquecimento)
CREATE OR REPLACE FUNCTION public.delete_cliente_lgpd(_cpf text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;
  IF d !~ '^[0-9]{11}$' THEN
    RAISE EXCEPTION 'CPF inválido';
  END IF;

  INSERT INTO public.admin_audit_log(admin_id, acao, cliente_cpf, detalhes)
  VALUES (auth.uid(), 'delete', d, jsonb_build_object('motivo', 'lgpd'));

  DELETE FROM public.clientes WHERE cpf = d;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_cliente_lgpd(text) TO authenticated;
