
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  existing INT;
BEGIN
  IF uid IS NULL THEN RETURN FALSE; END IF;
  SELECT count(*) INTO existing FROM public.admins;
  IF existing > 0 THEN
    RETURN EXISTS (SELECT 1 FROM public.admins WHERE user_id = uid);
  END IF;
  INSERT INTO public.admins (user_id) VALUES (uid);
  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;
