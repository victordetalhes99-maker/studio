DROP FUNCTION IF EXISTS public.checkin_get_cliente(text);

CREATE OR REPLACE FUNCTION public.checkin_get_cliente(_cpf text)
RETURNS SETOF public.clientes
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.clientes
  WHERE cpf = regexp_replace(coalesce(_cpf, ''), '\D', '', 'g')
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.checkin_get_cliente(text) TO anon, authenticated;