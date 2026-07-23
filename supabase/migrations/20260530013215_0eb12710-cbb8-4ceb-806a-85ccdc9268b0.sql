-- 1) Versão mínima de checkin_get_cliente: só devolve o necessário ao kiosk
DROP FUNCTION IF EXISTS public.checkin_get_cliente(text);

CREATE FUNCTION public.checkin_get_cliente(_cpf text)
RETURNS TABLE (
  cpf text,
  nome_completo text,
  tatuador text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.cpf, c.nome_completo, c.tatuador
  FROM public.clientes c
  WHERE c.cpf = regexp_replace(coalesce(_cpf, ''), '\D', '', 'g')
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.checkin_get_cliente(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkin_get_cliente(text) TO anon, authenticated;

-- 2) checkin_append_sessao: aceita o parâmetro _anamnese por compatibilidade, mas IGNORA
--    (anon não pode mais sobrescrever ficha médica). Só anexa a sessão e atualiza tatuador.
CREATE OR REPLACE FUNCTION public.checkin_append_sessao(
  _cpf text,
  _sessao jsonb,
  _anamnese jsonb DEFAULT NULL,
  _tatuador text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cpf_d text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  s_size int;
BEGIN
  -- Validações de tamanho (anti-abuso)
  s_size := octet_length(coalesce(_sessao::text, ''));
  IF s_size > 1048576 THEN
    RAISE EXCEPTION 'Sessão muito grande';
  END IF;

  -- _anamnese é deliberadamente IGNORADO no fluxo público (security fix).
  -- Admins atualizam anamnese diretamente pela tabela (via RLS).
  UPDATE public.clientes
  SET
    sessoes = coalesce(sessoes, '[]'::jsonb) || coalesce(_sessao, '{}'::jsonb),
    tatuador = COALESCE(NULLIF(trim(_tatuador), ''), tatuador),
    dados_cadastrais = CASE
      WHEN NULLIF(trim(_tatuador), '') IS NOT NULL
        THEN jsonb_set(coalesce(dados_cadastrais, '{}'::jsonb), '{tatuador}', to_jsonb(trim(_tatuador)))
      ELSE dados_cadastrais
    END,
    atualizado_em = now()
  WHERE cpf = cpf_d;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cliente não encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.checkin_append_sessao(text, jsonb, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkin_append_sessao(text, jsonb, jsonb, text) TO anon, authenticated;