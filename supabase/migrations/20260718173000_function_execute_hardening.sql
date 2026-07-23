begin;

revoke execute on function public.anonymize_cliente(text) from public, anon;
grant execute on function public.anonymize_cliente(text) to authenticated;

revoke execute on function public.delete_cliente_lgpd(text) from public, anon;
grant execute on function public.delete_cliente_lgpd(text) to authenticated;

revoke execute on function public.log_admin_action(text, text, jsonb, text, text) from public, anon;
grant execute on function public.log_admin_action(text, text, jsonb, text, text) to authenticated;

revoke execute on function public.latest_backup_status() from public, anon;
grant execute on function public.latest_backup_status() to authenticated;

revoke execute on function public.risk_review_set(text, text, text, integer, text, text, text, text, text) from public, anon;
grant execute on function public.risk_review_set(text, text, text, integer, text, text, text, text, text) to authenticated;

revoke execute on function public.risk_review_add_note(text, text) from public, anon;
grant execute on function public.risk_review_add_note(text, text) to authenticated;

revoke execute on function public.risk_review_archive(text, text) from public, anon;
grant execute on function public.risk_review_archive(text, text) to authenticated;

revoke execute on function public.tg_set_atualizado_em() from public, anon, authenticated;
revoke execute on function public.tg_validate_cliente() from public, anon, authenticated;
revoke execute on function public.tg_data_subject_requests_defaults() from public, anon, authenticated;
revoke execute on function public.tg_risk_reviews_touch() from public, anon, authenticated;
revoke execute on function public.tg_check_ins_log_event() from public, anon, authenticated;
revoke execute on function public.tg_check_ins_validate() from public, anon, authenticated;

commit;
