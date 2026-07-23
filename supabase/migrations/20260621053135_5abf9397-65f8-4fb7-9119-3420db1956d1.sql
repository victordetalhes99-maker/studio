
CREATE TABLE public.backup_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status text NOT NULL,                -- 'success' | 'error'
  mensagem text,
  spreadsheet_id text,
  spreadsheet_url text,
  csv_tab text,
  total_clientes int,
  duracao_ms int,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX backup_logs_iniciado_idx ON public.backup_logs(iniciado_em DESC);

GRANT SELECT ON public.backup_logs TO authenticated;
GRANT ALL ON public.backup_logs TO service_role;

ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read backup_logs"
  ON public.backup_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Mantém só os últimos 30
CREATE OR REPLACE FUNCTION public.prune_backup_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.backup_logs
   WHERE id IN (
     SELECT id FROM public.backup_logs
      ORDER BY iniciado_em DESC OFFSET 30
   );
END;
$$;

-- Registro chamado pela edge function (via service_role; mas exponho RPC para o caso de admin manual)
CREATE OR REPLACE FUNCTION public.register_backup_log(
  _status text,
  _mensagem text,
  _spreadsheet_id text DEFAULT NULL,
  _spreadsheet_url text DEFAULT NULL,
  _csv_tab text DEFAULT NULL,
  _total_clientes int DEFAULT NULL,
  _duracao_ms int DEFAULT NULL,
  _detalhes jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF _status NOT IN ('success', 'error') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  INSERT INTO public.backup_logs(
    status, mensagem, spreadsheet_id, spreadsheet_url, csv_tab,
    total_clientes, duracao_ms, detalhes, concluido_em
  )
  VALUES (
    _status, left(coalesce(_mensagem, ''), 4000),
    _spreadsheet_id, _spreadsheet_url, _csv_tab,
    _total_clientes, _duracao_ms, coalesce(_detalhes, '{}'::jsonb), now()
  )
  RETURNING id INTO new_id;

  PERFORM public.prune_backup_logs();
  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_backup_log(text, text, text, text, text, int, int, jsonb) TO service_role, authenticated;

-- Status do último backup (usado pelo painel admin)
CREATE OR REPLACE FUNCTION public.latest_backup_status()
RETURNS TABLE(
  status text,
  mensagem text,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  spreadsheet_url text,
  total_clientes int,
  duracao_ms int
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status, mensagem, iniciado_em, concluido_em, spreadsheet_url, total_clientes, duracao_ms
    FROM public.backup_logs
   ORDER BY iniciado_em DESC
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.latest_backup_status() TO authenticated;
