CREATE OR REPLACE FUNCTION public.tg_validate_cliente()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  is_anon boolean := (auth.uid() IS NULL);
BEGIN
  NEW.cpf := regexp_replace(coalesce(NEW.cpf, ''), '\D', '', 'g');
  IF NEW.cpf !~ '^[0-9]{11}$' THEN
    RAISE EXCEPTION 'CPF inválido';
  END IF;

  NEW.nome_completo := btrim(coalesce(NEW.nome_completo, ''));
  IF length(NEW.nome_completo) < 2 OR length(NEW.nome_completo) > 200 THEN
    RAISE EXCEPTION 'Nome inválido';
  END IF;

  IF NEW.telefone IS NOT NULL AND length(NEW.telefone) > 32 THEN
    RAISE EXCEPTION 'Telefone muito longo';
  END IF;
  IF NEW.email IS NOT NULL AND length(NEW.email) > 254 THEN
    RAISE EXCEPTION 'E-mail muito longo';
  END IF;
  IF NEW.tatuador IS NOT NULL AND length(NEW.tatuador) > 120 THEN
    RAISE EXCEPTION 'Tatuador inválido';
  END IF;

  IF pg_column_size(NEW.dados_cadastrais) > 16384 THEN
    RAISE EXCEPTION 'dados_cadastrais excede o tamanho permitido';
  END IF;
  IF pg_column_size(NEW.anamnese) > 16384 THEN
    RAISE EXCEPTION 'anamnese excede o tamanho permitido';
  END IF;
  -- Cada sessão carrega a assinatura PNG em base64 (pode passar de 100KB).
  -- Permitir até ~20MB no histórico acumulado (≈100 sessões com assinatura grande).
  IF pg_column_size(NEW.sessoes) > 20971520 THEN
    RAISE EXCEPTION 'sessoes excede o tamanho permitido';
  END IF;
  IF NEW.assinatura IS NOT NULL AND length(NEW.assinatura) > 2000000 THEN
    RAISE EXCEPTION 'assinatura excede o tamanho permitido';
  END IF;

  IF is_anon THEN
    NEW.status := 'aguardando';
    NEW.criado_em := now();
    NEW.atualizado_em := now();
  END IF;

  IF NEW.status NOT IN ('aguardando', 'atendido') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  RETURN NEW;
END;
$function$;