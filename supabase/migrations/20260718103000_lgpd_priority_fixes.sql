-- ============================================================================
-- LGPD priority fixes - July 18, 2026
-- ============================================================================

ALTER TABLE public.consent_records
  ADD COLUMN IF NOT EXISTS finalidade text,
  ADD COLUMN IF NOT EXISTS contexto text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'granted',
  ADD COLUMN IF NOT EXISTS consent_scope text NOT NULL DEFAULT 'required',
  ADD COLUMN IF NOT EXISTS titular_ref text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS revogado_em timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'consent_records_status_check'
  ) THEN
    ALTER TABLE public.consent_records
      ADD CONSTRAINT consent_records_status_check
      CHECK (status IN ('granted','denied','revoked'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'consent_records_scope_check'
  ) THEN
    ALTER TABLE public.consent_records
      ADD CONSTRAINT consent_records_scope_check
      CHECK (consent_scope IN ('required','optional'));
  END IF;
END $$;

DROP POLICY IF EXISTS "Public consent insert" ON public.consent_records;
CREATE POLICY "Public consent insert"
  ON public.consent_records FOR INSERT TO anon, authenticated
  WITH CHECK (
    cpf ~ '^[0-9]{11}$'
    AND tipo IN ('lgpd','termo','anamnese','imagem')
    AND length(texto_hash) BETWEEN 8 AND 128
    AND status IN ('granted','denied','revoked')
    AND consent_scope IN ('required','optional')
  );

CREATE OR REPLACE FUNCTION public.registrar_consentimento(
  _cpf text,
  _tipo text,
  _texto_hash text,
  _versao text DEFAULT 'v1',
  _finalidade text DEFAULT NULL,
  _contexto text DEFAULT NULL,
  _status text DEFAULT 'granted',
  _consent_scope text DEFAULT 'required',
  _titular_ref text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _device jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE d text := regexp_replace(coalesce(_cpf,''), '\D', '', 'g');
DECLARE new_id uuid;
BEGIN
  IF d !~ '^[0-9]{11}$' THEN RAISE EXCEPTION 'CPF invalido'; END IF;
  IF _tipo NOT IN ('lgpd','termo','anamnese','imagem') THEN RAISE EXCEPTION 'Tipo invalido'; END IF;
  IF coalesce(_status,'') NOT IN ('granted','denied','revoked') THEN RAISE EXCEPTION 'Status invalido'; END IF;
  IF coalesce(_consent_scope,'') NOT IN ('required','optional') THEN RAISE EXCEPTION 'Escopo invalido'; END IF;

  INSERT INTO public.consent_records(
    cpf, tipo, versao, texto_hash, finalidade, contexto, status, consent_scope,
    titular_ref, metadata, ip, user_agent, device, revogado_em
  )
  VALUES (
    d,
    _tipo,
    coalesce(_versao, 'v1'),
    _texto_hash,
    NULLIF(btrim(coalesce(_finalidade,'')), ''),
    NULLIF(btrim(coalesce(_contexto,'')), ''),
    coalesce(_status, 'granted'),
    coalesce(_consent_scope, 'required'),
    NULLIF(btrim(coalesce(_titular_ref,'')), ''),
    coalesce(_metadata, '{}'::jsonb),
    left(coalesce(_ip,''), 64),
    left(coalesce(_user_agent,''), 1024),
    coalesce(_device, '{}'::jsonb),
    CASE WHEN _status = 'revoked' THEN now() ELSE NULL END
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END $$;

GRANT EXECUTE ON FUNCTION public.registrar_consentimento(
  text, text, text, text, text, text, text, text, text, jsonb, text, text, jsonb
) TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.data_subject_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.data_subject_requests(id) ON DELETE CASCADE,
  actor_id uuid,
  event_kind text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.data_subject_request_events TO authenticated;
GRANT ALL ON public.data_subject_request_events TO service_role;
ALTER TABLE public.data_subject_request_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'data_subject_request_events'
      AND policyname = 'Admins read DSR events'
  ) THEN
    CREATE POLICY "Admins read DSR events"
      ON public.data_subject_request_events FOR SELECT TO authenticated USING (public.is_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'data_subject_request_events'
      AND policyname = 'Admins insert DSR events'
  ) THEN
    CREATE POLICY "Admins insert DSR events"
      ON public.data_subject_request_events FOR INSERT TO authenticated WITH CHECK (public.is_admin());
  END IF;
END $$;

ALTER TABLE public.data_subject_requests
  ADD COLUMN IF NOT EXISTS protocolo text,
  ADD COLUMN IF NOT EXISTS operation_id text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'verificacao_pendente',
  ADD COLUMN IF NOT EXISTS verification_token_hash text,
  ADD COLUMN IF NOT EXISTS verification_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS decision text,
  ADD COLUMN IF NOT EXISTS decision_reason text,
  ADD COLUMN IF NOT EXISTS affected_records jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS decided_by uuid,
  ADD COLUMN IF NOT EXISTS decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS due_at timestamptz NOT NULL DEFAULT (now() + interval '15 days');

UPDATE public.data_subject_requests
SET protocolo = coalesce(protocolo, upper(substr(replace(id::text, '-', ''), 1, 12)))
WHERE protocolo IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_subject_requests_protocolo
  ON public.data_subject_requests (protocolo);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'data_subject_requests_verification_status_check'
  ) THEN
    ALTER TABLE public.data_subject_requests
      ADD CONSTRAINT data_subject_requests_verification_status_check
      CHECK (verification_status IN ('verificacao_pendente','verificado','expirado','negado'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.tg_data_subject_requests_defaults()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.cpf IS NOT NULL THEN
    NEW.cpf := regexp_replace(NEW.cpf, '\D', '', 'g');
  END IF;
  IF NEW.protocolo IS NULL OR NEW.protocolo = '' THEN
    NEW.protocolo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  END IF;
  IF NEW.status IS NULL OR NEW.status = '' THEN
    NEW.status := 'verificacao_pendente';
  END IF;
  IF NEW.tipo NOT IN ('delete','anonymize','export','rectify') THEN
    RAISE EXCEPTION 'Tipo de solicitacao invalido';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_data_subject_requests_defaults ON public.data_subject_requests;
CREATE TRIGGER trg_data_subject_requests_defaults
BEFORE INSERT OR UPDATE ON public.data_subject_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_data_subject_requests_defaults();

CREATE TABLE IF NOT EXISTS public.retention_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_category text NOT NULL UNIQUE,
  finalidade text NOT NULL,
  prazo_dias integer,
  inicio_contagem text NOT NULL,
  acao_apos_prazo text NOT NULL,
  hipotese_conservacao text,
  responsavel text,
  review_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.retention_rules TO authenticated;
GRANT ALL ON public.retention_rules TO service_role;
ALTER TABLE public.retention_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'retention_rules'
      AND policyname = 'Admins gerenciam retention_rules'
  ) THEN
    CREATE POLICY "Admins gerenciam retention_rules"
      ON public.retention_rules FOR ALL TO authenticated
      USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.guardian_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_cpf text NOT NULL,
  responsavel_nome text,
  responsavel_contato text,
  validation_status text NOT NULL DEFAULT 'pending',
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.guardian_validations TO authenticated;
GRANT ALL ON public.guardian_validations TO service_role;
ALTER TABLE public.guardian_validations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'guardian_validations'
      AND policyname = 'Admins gerenciam guardian_validations'
  ) THEN
    CREATE POLICY "Admins gerenciam guardian_validations"
      ON public.guardian_validations FOR ALL TO authenticated
      USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.tg_validate_cliente()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE is_anon boolean := (auth.uid() IS NULL);
DECLARE birth_date text;
DECLARE birth_ts date;
DECLARE age_years integer;
BEGIN
  NEW.cpf := regexp_replace(coalesce(NEW.cpf, ''), '\D', '', 'g');
  IF NEW.cpf !~ '^[0-9]{11}$' THEN RAISE EXCEPTION 'CPF invalido'; END IF;
  NEW.nome_completo := btrim(coalesce(NEW.nome_completo, ''));
  IF length(NEW.nome_completo) < 2 OR length(NEW.nome_completo) > 200 THEN RAISE EXCEPTION 'Nome invalido'; END IF;
  IF NEW.telefone IS NOT NULL AND length(NEW.telefone) > 32 THEN RAISE EXCEPTION 'Telefone longo'; END IF;
  IF NEW.email IS NOT NULL AND length(NEW.email) > 254 THEN RAISE EXCEPTION 'E-mail longo'; END IF;
  IF NEW.tatuador IS NOT NULL AND length(NEW.tatuador) > 120 THEN RAISE EXCEPTION 'Tatuador invalido'; END IF;
  IF pg_column_size(NEW.dados_cadastrais) > 16384 THEN RAISE EXCEPTION 'dados grandes'; END IF;
  IF pg_column_size(NEW.anamnese) > 16384 THEN RAISE EXCEPTION 'anamnese grande'; END IF;
  IF pg_column_size(NEW.sessoes) > 20971520 THEN RAISE EXCEPTION 'sessoes grandes'; END IF;
  IF NEW.assinatura IS NOT NULL AND length(NEW.assinatura) > 2000000 THEN RAISE EXCEPTION 'assinatura grande'; END IF;

  birth_date := coalesce(NEW.dados_cadastrais->>'dataNascimento', '');
  IF birth_date <> '' THEN
    birth_ts := birth_date::date;
    age_years := date_part('year', age(current_date, birth_ts));
    NEW.dados_cadastrais := jsonb_set(coalesce(NEW.dados_cadastrais, '{}'::jsonb), '{idadeCalculada}', to_jsonb(age_years), true);
    NEW.dados_cadastrais := jsonb_set(coalesce(NEW.dados_cadastrais, '{}'::jsonb), '{faixaEtaria}', to_jsonb(CASE WHEN age_years < 18 THEN 'menor' ELSE 'adulto' END), true);
    NEW.dados_cadastrais := jsonb_set(coalesce(NEW.dados_cadastrais, '{}'::jsonb), '{guardianValidationStatus}', to_jsonb(CASE WHEN age_years < 18 THEN 'pending' ELSE 'not_required' END), true);
    IF age_years < 18 THEN
      NEW.status := 'pendente_responsavel';
    END IF;
  END IF;

  IF is_anon THEN
    NEW.criado_em := now();
    NEW.atualizado_em := now();
  END IF;
  IF NEW.status NOT IN ('aguardando','atendido','pendente_responsavel') THEN
    RAISE EXCEPTION 'Status invalido';
  END IF;
  RETURN NEW;
END $$;

INSERT INTO public.retention_rules (data_category, finalidade, prazo_dias, inicio_contagem, acao_apos_prazo, hipotese_conservacao, responsavel)
VALUES
  ('cadastros', 'Identificacao e continuidade operacional', 3650, 'ultima_interacao', 'revisao_administrativa', 'Obrigacao legal ou exercicio regular de direitos', 'Administracao'),
  ('fichas_saude', 'Triagem e seguranca do procedimento', 3650, 'ultima_sessao', 'bloqueio_ou_anonimizacao', 'Tutela da saude e obrigacoes sanitarias', 'Responsavel tecnico'),
  ('contratos_termos', 'Prova documental e auditoria', 3650, 'aceite', 'arquivamento_restrito', 'Exercicio regular de direitos', 'Administracao'),
  ('imagens', 'Registro tecnico e uso opcional de imagem', 365, 'revogacao_ou_ultima_utilizacao', 'revisao_administrativa', 'Conservacao minima para defesa ou obrigacao aplicavel', 'Marketing/Administracao'),
  ('solicitacoes_lgpd', 'Atendimento ao titular e prova de decisao', 1825, 'encerramento', 'arquivamento_restrito', 'Exercicio regular de direitos', 'Privacidade')
ON CONFLICT (data_category) DO NOTHING;
