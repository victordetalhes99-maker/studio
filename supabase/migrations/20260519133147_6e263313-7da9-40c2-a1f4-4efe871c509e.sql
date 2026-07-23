-- Reverte revoke anterior que quebrou as policies que dependem de is_admin()
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- RPC para o fluxo público de check-in: retorna o cliente pelo CPF (ou null)
CREATE OR REPLACE FUNCTION public.checkin_get_cliente(_cpf text)
RETURNS public.clientes
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.clientes
  WHERE cpf = regexp_replace(coalesce(_cpf, ''), '\D', '', 'g')
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.checkin_get_cliente(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkin_get_cliente(text) TO anon, authenticated;

-- RPC para o fluxo público de cliente recorrente: anexa uma sessão
CREATE OR REPLACE FUNCTION public.checkin_append_sessao(
  _cpf text,
  _sessao jsonb,
  _anamnese jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
BEGIN
  IF d !~ '^[0-9]{11}$' THEN
    RAISE EXCEPTION 'CPF inválido';
  END IF;
  IF _sessao IS NULL OR jsonb_typeof(_sessao) <> 'object' THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;
  IF pg_column_size(_sessao) > 2097152 THEN
    RAISE EXCEPTION 'Sessão excede o tamanho permitido';
  END IF;

  UPDATE public.clientes
  SET sessoes = COALESCE(sessoes, '[]'::jsonb) || jsonb_build_array(_sessao),
      anamnese = COALESCE(_anamnese, anamnese),
      atualizado_em = now()
  WHERE cpf = d;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.checkin_append_sessao(text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkin_append_sessao(text, jsonb, jsonb) TO anon, authenticated;