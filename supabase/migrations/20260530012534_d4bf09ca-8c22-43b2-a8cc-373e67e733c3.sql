-- Tabela de configurações do app (chave/valor) usada pra guardar o ID da planilha de backup
CREATE TABLE public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Só admins podem ler/escrever configurações
CREATE POLICY "Admins podem ler app_config"
  ON public.app_config FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins podem inserir app_config"
  ON public.app_config FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins podem atualizar app_config"
  ON public.app_config FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- Habilitar extensões pra agendamento HTTP
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
