
REVOKE EXECUTE ON FUNCTION public.checkin_create(text,text,text,boolean,text[],boolean,boolean,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.checkin_call(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.checkin_start(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.checkin_complete(uuid,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.checkin_cancel(uuid,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.checkin_no_show(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.checkin_add_note(uuid,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.checkin_reorder(uuid,integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.checkin_create(text,text,text,boolean,text[],boolean,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_call(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_start(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_complete(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_cancel(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_no_show(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_add_note(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_reorder(uuid,integer) TO authenticated;
