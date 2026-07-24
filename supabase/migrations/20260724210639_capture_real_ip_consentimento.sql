-- =============================================================================
-- Captura real de IP no consentimento — sem depender do navegador
--
-- Antes: registrar_consentimento aceitava um parametro _ip vindo do
-- frontend, mas o frontend nunca enviava nada (o navegador nao tem como
-- saber o proprio IP publico), entao o campo sempre ficava vazio. Alem
-- disso, mesmo que o frontend enviasse um valor, ele nao teria nenhum valor
-- probatorio real — o cliente poderia enviar qualquer coisa.
--
-- Agora: o IP e lido diretamente dos cabecalhos da requisicao HTTP que o
-- Postgres recebe via PostgREST (exposto em current_setting('request.headers')),
-- olhando primeiro o cabecalho que o Cloudflare sempre preenche de forma
-- confiavel (cf-connecting-ip) e, se ausente, o x-forwarded-for padrao.
-- Qualquer valor de IP que o chamador tente enviar via parametro e
-- ignorado — o valor real e sempre resolvido no servidor.
-- =============================================================================

create or replace function public.registrar_consentimento(
  _cpf text,
  _tipo text,
  _texto_hash text,
  _versao text default null,
  _finalidade text default null,
  _contexto text default null,
  _status text default 'granted',
  _consent_scope text default 'required',
  _titular_ref text default null,
  _metadata jsonb default '{}'::jsonb,
  _document_type text default null,
  _template_version text default null,
  _template_hash text default null,
  _rendered_text text default null,
  _rendered_html text default null,
  _config_snapshot jsonb default '{}'::jsonb,
  _client_snapshot jsonb default '{}'::jsonb,
  _artist_snapshot jsonb default '{}'::jsonb,
  _accepted_at timestamptz default null,
  _accepted_by text default null,
  _signature_snapshot jsonb default '{}'::jsonb,
  _source text default null,
  _ip text default null,
  _user_agent text default null,
  _device jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_accepted_at timestamptz := coalesce(_accepted_at, now());
  v_headers json;
  v_ip text;
begin
  -- Le os cabecalhos reais da requisicao HTTP (expostos pelo PostgREST).
  -- Se algo der errado ao interpretar os cabecalhos, segue sem IP em vez
  -- de falhar o cadastro inteiro por causa disso.
  begin
    v_headers := current_setting('request.headers', true)::json;
    v_ip := coalesce(
      nullif(v_headers ->> 'cf-connecting-ip', ''),
      nullif(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1), '')
    );
  exception when others then
    v_ip := null;
  end;

  insert into public.consent_records (
    id,
    cpf,
    tipo,
    versao,
    texto_hash,
    finalidade,
    contexto,
    status,
    consent_scope,
    titular_ref,
    metadata,
    ip,
    user_agent,
    device,
    criado_em,
    revogado_em,
    document_type,
    template_version,
    template_hash,
    rendered_text,
    rendered_html,
    config_snapshot,
    client_snapshot,
    artist_snapshot,
    accepted_at,
    accepted_by,
    signature_snapshot,
    source,
    created_at
  )
  values (
    v_id,
    regexp_replace(coalesce(_cpf, ''), '\D', '', 'g'),
    _tipo,
    coalesce(nullif(_versao, ''), 'v1'),
    _texto_hash,
    _finalidade,
    _contexto,
    coalesce(nullif(_status, ''), 'granted'),
    coalesce(nullif(_consent_scope, ''), 'required'),
    _titular_ref,
    coalesce(_metadata, '{}'::jsonb),
    v_ip,
    _user_agent,
    coalesce(_device, '{}'::jsonb),
    v_accepted_at,
    null,
    coalesce(
      nullif(_document_type, ''),
      case _tipo
        when 'termo' then 'contract'
        when 'lgpd' then 'lgpd'
        when 'anamnese' then 'anamnese'
        when 'imagem' then 'image'
        else _tipo
      end
    ),
    coalesce(nullif(_template_version, ''), nullif(_versao, ''), 'v1'),
    nullif(_template_hash, ''),
    _rendered_text,
    _rendered_html,
    coalesce(_config_snapshot, '{}'::jsonb),
    coalesce(_client_snapshot, '{}'::jsonb),
    coalesce(_artist_snapshot, '{}'::jsonb),
    v_accepted_at,
    nullif(_accepted_by, ''),
    coalesce(_signature_snapshot, '{}'::jsonb),
    nullif(_source, ''),
    v_accepted_at
  );

  return v_id;
end;
$$;

grant execute on function public.registrar_consentimento(
  text, text, text, text, text, text, text, text, text, jsonb, text, text, text, text, text, jsonb, jsonb, jsonb, timestamptz, text, jsonb, text, text, text, jsonb
) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
