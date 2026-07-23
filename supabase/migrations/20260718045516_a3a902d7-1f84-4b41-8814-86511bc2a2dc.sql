-- =========================================================
-- Central de proteção de dados — 85 TATTOO
-- Tabelas: destinos, política, jobs, restore, auditoria
-- =========================================================

-- Destinos de backup (R2 / Google Drive / Local)
CREATE TABLE public.backup_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('r2','google_drive','local')),
  label text NOT NULL,
  config_masked jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'nao_configurado'
    CHECK (status IN ('nao_configurado','configuracao_incompleta','conectado','erro','desativado')),
  last_tested_at timestamptz,
  last_error text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_destinations TO authenticated;
GRANT ALL ON public.backup_destinations TO service_role;
ALTER TABLE public.backup_destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam destinos" ON public.backup_destinations
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_backup_destinations_updated
  BEFORE UPDATE ON public.backup_destinations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();

-- Política única de backup
CREATE TABLE public.backup_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  auto_enabled boolean NOT NULL DEFAULT false,
  frequency text NOT NULL DEFAULT 'diario'
    CHECK (frequency IN ('diario','semanal','mensal','personalizado','desativado')),
  hour smallint NOT NULL DEFAULT 3 CHECK (hour BETWEEN 0 AND 23),
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  retention_daily smallint NOT NULL DEFAULT 7,
  retention_weekly smallint NOT NULL DEFAULT 4,
  retention_monthly smallint NOT NULL DEFAULT 6,
  retention_yearly smallint NOT NULL DEFAULT 1,
  content jsonb NOT NULL DEFAULT '{
    "clientes":true,"tatuadores":true,"fichas":true,"contratos":true,
    "assinaturas":true,"check_ins":true,"documentos":true,"configuracoes":true,
    "logs":false
  }'::jsonb,
  encryption_enabled boolean NOT NULL DEFAULT false,
  encryption_version text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_settings TO authenticated;
GRANT ALL ON public.backup_settings TO service_role;
ALTER TABLE public.backup_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam politica" ON public.backup_settings
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_backup_settings_updated
  BEFORE UPDATE ON public.backup_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();
INSERT INTO public.backup_settings (singleton) VALUES (true);

-- Execuções de backup
CREATE TABLE public.backup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('completo','banco','documentos','incremental','manual')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','completed','partial','failed','cancelado','validando')),
  destination_id uuid REFERENCES public.backup_destinations(id) ON DELETE SET NULL,
  destination_kind text,
  stage text,
  progress_stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  size_bytes bigint,
  duration_ms integer,
  checksum_sha256 text,
  manifest jsonb,
  storage_path text,
  error_message text,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  registros_incluidos integer,
  arquivos_incluidos integer,
  system_version text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX idx_backup_jobs_started_at ON public.backup_jobs (started_at DESC);
CREATE INDEX idx_backup_jobs_status ON public.backup_jobs (status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_jobs TO authenticated;
GRANT ALL ON public.backup_jobs TO service_role;
ALTER TABLE public.backup_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam jobs" ON public.backup_jobs
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Solicitações de restauração
CREATE TABLE public.restore_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_job_id uuid REFERENCES public.backup_jobs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'preview'
    CHECK (status IN ('preview','aguardando_confirmacao','running','completed','failed','cancelado','bloqueado')),
  scope text NOT NULL DEFAULT 'completo'
    CHECK (scope IN ('completo','banco','documentos','configuracoes','parcial','cliente')),
  preview jsonb,
  impact jsonb,
  snapshot_job_id uuid REFERENCES public.backup_jobs(id) ON DELETE SET NULL,
  error_message text,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restore_jobs TO authenticated;
GRANT ALL ON public.restore_jobs TO service_role;
ALTER TABLE public.restore_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam restauracao" ON public.restore_jobs
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Auditoria específica da central de backup
CREATE TABLE public.backup_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_kind text,
  target_id uuid,
  ip text,
  user_agent text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_backup_audit_criado_em ON public.backup_audit_log (criado_em DESC);
GRANT SELECT, INSERT ON public.backup_audit_log TO authenticated;
GRANT ALL ON public.backup_audit_log TO service_role;
ALTER TABLE public.backup_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins leem auditoria" ON public.backup_audit_log
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins inserem auditoria" ON public.backup_audit_log
  FOR INSERT TO authenticated WITH CHECK (public.is_admin() AND actor = auth.uid());

-- View: overview real para o dashboard da central
CREATE OR REPLACE VIEW public.backup_overview AS
SELECT
  (SELECT count(*) FROM public.backup_destinations WHERE status = 'conectado') AS destinos_conectados,
  (SELECT count(*) FROM public.backup_destinations) AS destinos_total,
  (SELECT jsonb_build_object(
      'id', id, 'type', type, 'status', status, 'size_bytes', size_bytes,
      'duration_ms', duration_ms, 'started_at', started_at, 'completed_at', completed_at,
      'checksum_sha256', checksum_sha256, 'destination_kind', destination_kind)
   FROM public.backup_jobs
   WHERE status IN ('completed','partial') ORDER BY started_at DESC LIMIT 1) AS ultimo_backup,
  (SELECT auto_enabled FROM public.backup_settings WHERE singleton) AS auto_enabled,
  (SELECT encryption_enabled FROM public.backup_settings WHERE singleton) AS encryption_enabled;

GRANT SELECT ON public.backup_overview TO authenticated;