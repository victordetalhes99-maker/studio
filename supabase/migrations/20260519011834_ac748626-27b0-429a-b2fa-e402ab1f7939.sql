-- Restore EXECUTE on is_admin() to authenticated role.
-- It is required for the RLS policies on public.clientes to evaluate when an
-- authenticated user (the studio admin) queries the table or subscribes to
-- Realtime changes. is_admin() is SECURITY DEFINER and only reads admins.user_id,
-- so granting EXECUTE does not leak data — it just returns boolean for auth.uid().
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
