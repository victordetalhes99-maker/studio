CREATE OR REPLACE FUNCTION public.checkin_append_sessao(
  _cpf text,
  _sessao jsonb,
  _anamnese jsonb DEFAULT NULL::jsonb,
  _tatuador text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  d text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  tat text := nullif(btrim(coalesce(_tatuador, '')), '');
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
  IF tat IS NOT NULL AND length(tat) > 120 THEN
    RAISE EXCEPTION 'Tatuador inválido';
  END IF;

  UPDATE public.clientes
  SET sessoes = COALESCE(sessoes, '[]'::jsonb) || jsonb_build_array(_sessao),
      anamnese = COALESCE(_anamnese, anamnese),
      tatuador = COALESCE(tat, tatuador),
      dados_cadastrais = CASE
        WHEN tat IS NOT NULL
          THEN jsonb_set(COALESCE(dados_cadastrais, '{}'::jsonb), '{tatuador}', to_jsonb(tat), true)
        ELSE dados_cadastrais
      END,
      atualizado_em = now()
  WHERE cpf = d;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;
END;
$function$;