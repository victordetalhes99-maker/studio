-- =============================================================================
-- Exclusao definitiva e imediata de um cliente (admin-only)
--
-- Diferente de "Solicitar eliminacao" (que so cria um pedido pendente em
-- data_subject_requests para analise formal LGPD), esta RPC apaga de
-- verdade e na hora: cliente, ficha (embutida em clientes), contrato/
-- consentimentos, check-ins e revisoes de risco associadas ao CPF.
--
-- Uso pretendido: limpar cadastros de teste ou feitos por engano. Para
-- solicitacoes de titular de dados reais, o fluxo formal continua sendo
-- "Solicitar eliminacao".
--
-- A exclusao do arquivo de assinatura no Storage e feita pelo frontend
-- separadamente (RLS de storage.objects ja permite admin deletar do bucket
-- assinaturas) — Postgres puro nao tem acesso ao Storage.
-- =============================================================================

create or replace function public.excluir_cliente_definitivamente(_cpf text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  v_nome text;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem excluir clientes definitivamente.';
  end if;
  if d_cpf = '' then
    raise exception 'CPF invalido';
  end if;

  select nome_completo into v_nome from public.clientes where cpf = d_cpf;
  if v_nome is null then
    raise exception 'Cliente nao encontrado.';
  end if;

  delete from public.check_in_events
  where check_in_id in (select id from public.check_ins where cpf = d_cpf);

  delete from public.check_ins where cpf = d_cpf;

  delete from public.risk_review_events
  where alert_id in (select alert_id from public.risk_reviews where cpf = d_cpf);

  delete from public.risk_reviews where cpf = d_cpf;

  delete from public.consent_records where cpf = d_cpf;

  delete from public.clientes where cpf = d_cpf;

  insert into public.admin_audit_log (admin_id, acao, cliente_cpf, detalhes)
  values (
    auth.uid(),
    'excluir_cliente_definitivamente',
    d_cpf,
    jsonb_build_object('nome_completo_no_momento', v_nome)
  );
end;
$$;

revoke execute on function public.excluir_cliente_definitivamente(text) from public, anon;
grant execute on function public.excluir_cliente_definitivamente(text) to authenticated;

notify pgrst, 'reload schema';
