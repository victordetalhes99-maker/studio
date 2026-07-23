-- 1) Remove the public "claim first admin" function — admins are provisioned manually
DROP FUNCTION IF EXISTS public.claim_first_admin();

-- 2) Lock down admins INSERT (no policy exists, so it's already denied to clients).
--    Make sure no permissive INSERT policy exists.
DROP POLICY IF EXISTS "Anyone can become admin" ON public.admins;

-- 3) Replace the permissive anon INSERT policy with an explicit one that also
--    requires basic shape (defense-in-depth alongside the validation trigger)
DROP POLICY IF EXISTS "Anyone can create checkin" ON public.clientes;

CREATE POLICY "Public check-in insert (validated)"
ON public.clientes
FOR INSERT
TO anon, authenticated
WITH CHECK (
  cpf ~ '^[0-9]{11}$'
  AND length(nome_completo) BETWEEN 2 AND 200
  AND status = 'aguardando'
);

-- 4) Server-side validation trigger for ALL inserts/updates on clientes.
--    Sanitizes anon submissions and enforces field limits to block payload abuse.
CREATE OR REPLACE FUNCTION public.tg_validate_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  is_anon boolean := (auth.uid() IS NULL);
BEGIN
  -- Normalize CPF (digits only)
  NEW.cpf := regexp_replace(coalesce(NEW.cpf, ''), '\D', '', 'g');
  IF NEW.cpf !~ '^[0-9]{11}$' THEN
    RAISE EXCEPTION 'CPF inválido';
  END IF;

  -- Name required, length-limited
  NEW.nome_completo := btrim(coalesce(NEW.nome_completo, ''));
  IF length(NEW.nome_completo) < 2 OR length(NEW.nome_completo) > 200 THEN
    RAISE EXCEPTION 'Nome inválido';
  END IF;

  -- Optional fields: enforce max lengths
  IF NEW.telefone IS NOT NULL AND length(NEW.telefone) > 32 THEN
    RAISE EXCEPTION 'Telefone muito longo';
  END IF;
  IF NEW.email IS NOT NULL AND length(NEW.email) > 254 THEN
    RAISE EXCEPTION 'E-mail muito longo';
  END IF;
  IF NEW.tatuador IS NOT NULL AND length(NEW.tatuador) > 120 THEN
    RAISE EXCEPTION 'Tatuador inválido';
  END IF;

  -- Cap JSON payload sizes to prevent abuse
  IF pg_column_size(NEW.dados_cadastrais) > 16384 THEN
    RAISE EXCEPTION 'dados_cadastrais excede o tamanho permitido';
  END IF;
  IF pg_column_size(NEW.anamnese) > 16384 THEN
    RAISE EXCEPTION 'anamnese excede o tamanho permitido';
  END IF;
  IF pg_column_size(NEW.sessoes) > 65536 THEN
    RAISE EXCEPTION 'sessoes excede o tamanho permitido';
  END IF;
  IF NEW.assinatura IS NOT NULL AND length(NEW.assinatura) > 500000 THEN
    RAISE EXCEPTION 'assinatura excede o tamanho permitido';
  END IF;

  -- Anonymous submissions: force safe defaults, block protected field manipulation
  IF is_anon THEN
    NEW.status := 'aguardando';
    NEW.sessoes := '[]'::jsonb;
    -- prevent timestamp spoofing
    NEW.criado_em := now();
    NEW.atualizado_em := now();
  END IF;

  -- Restrict status values
  IF NEW.status NOT IN ('aguardando', 'atendido') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_cliente_biu ON public.clientes;
CREATE TRIGGER validate_cliente_biu
BEFORE INSERT OR UPDATE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.tg_validate_cliente();

-- 5) Realtime hardening: ensure the publication only exposes clientes via RLS
--    (RLS already restricts SELECT to is_admin(); Realtime respects RLS).
--    Re-assert the SELECT policy is admin-only and remove any legacy permissive policy.
DROP POLICY IF EXISTS "Public read clientes" ON public.clientes;
DROP POLICY IF EXISTS "Anyone can read clientes" ON public.clientes;