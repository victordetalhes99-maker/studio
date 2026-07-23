create or replace function public.prune_backup_logs()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.backup_logs
  where id in (
    select id
    from public.backup_logs
    order by iniciado_em desc
    offset 30
  );
end;
$$;

revoke all on function public.prune_backup_logs() from public, anon, authenticated;
grant execute on function public.prune_backup_logs() to service_role;

create or replace function public.register_backup_log(
  _status text,
  _mensagem text,
  _spreadsheet_id text default null,
  _spreadsheet_url text default null,
  _csv_tab text default null,
  _total_clientes integer default null,
  _duracao_ms integer default null,
  _detalhes jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_log_id uuid;
  started_at_value timestamptz;
  checksum_value text;
  warnings_value jsonb;
begin
  if _status not in ('success', 'error') then
    raise exception 'Status invalido';
  end if;

  insert into public.backup_logs (
    status,
    mensagem,
    spreadsheet_id,
    spreadsheet_url,
    csv_tab,
    total_clientes,
    duracao_ms,
    detalhes,
    concluido_em
  )
  values (
    _status,
    left(coalesce(_mensagem, ''), 4000),
    _spreadsheet_id,
    _spreadsheet_url,
    _csv_tab,
    _total_clientes,
    _duracao_ms,
    coalesce(_detalhes, '{}'::jsonb),
    now()
  )
  returning id into new_log_id;

  begin
    started_at_value := nullif(coalesce(_detalhes->>'started_at', ''), '')::timestamptz;
  exception
    when others then
      started_at_value := null;
  end;

  checksum_value := nullif(coalesce(_detalhes->>'checksum_sha256', ''), '');
  warnings_value := case
    when jsonb_typeof(_detalhes->'warnings') = 'array' then _detalhes->'warnings'
    else '[]'::jsonb
  end;

  insert into public.backup_jobs (
    type,
    status,
    destination_kind,
    stage,
    progress_stages,
    content,
    duration_ms,
    checksum_sha256,
    manifest,
    error_message,
    warnings,
    registros_incluidos,
    started_at,
    completed_at
  )
  values (
    'manual',
    case when _status = 'success' then 'completed' else 'failed' end,
    coalesce(nullif(_detalhes->>'destination_kind', ''), 'google_drive'),
    case when _status = 'success' then 'finalizado' else 'erro' end,
    case
      when _status = 'success' then
        jsonb_build_array(
          jsonb_build_object('label', 'Exportacao Google Sheets', 'done', true)
        )
      else
        jsonb_build_array(
          jsonb_build_object(
            'label',
            'Exportacao Google Sheets',
            'done',
            false,
            'error',
            left(coalesce(_mensagem, ''), 500)
          )
        )
    end,
    coalesce(
      _detalhes->'content',
      jsonb_build_object(
        'Banco de dados', true,
        'Documentos e PDFs', false,
        'Assinaturas', false,
        'Configuracoes', true
      )
    ),
    _duracao_ms,
    checksum_value,
    jsonb_strip_nulls(
      jsonb_build_object(
        'backup_log_id', new_log_id,
        'spreadsheet_id', _spreadsheet_id,
        'spreadsheet_url', _spreadsheet_url,
        'csv_tab', _csv_tab,
        'details', coalesce(_detalhes, '{}'::jsonb)
      )
    ),
    case when _status = 'error' then left(coalesce(_mensagem, ''), 4000) else null end,
    warnings_value,
    _total_clientes,
    coalesce(started_at_value, now()),
    now()
  );

  perform public.prune_backup_logs();
  return new_log_id;
end;
$$;

revoke all on function public.register_backup_log(text, text, text, text, text, integer, integer, jsonb)
from public, anon, authenticated;
grant execute on function public.register_backup_log(text, text, text, text, text, integer, integer, jsonb)
to service_role;
