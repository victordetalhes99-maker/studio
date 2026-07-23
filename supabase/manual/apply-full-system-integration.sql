begin;

create extension if not exists pgcrypto;

create table if not exists public.tattoo_artists (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists tattoo_artists_nome_key on public.tattoo_artists (lower(nome));
create unique index if not exists tattoo_artists_slug_key on public.tattoo_artists (slug);

grant select on public.tattoo_artists to anon, authenticated;
grant insert, update, delete on public.tattoo_artists to authenticated;
grant all on public.tattoo_artists to service_role;

alter table public.tattoo_artists enable row level security;

drop trigger if exists tattoo_artists_set_atualizado_em on public.tattoo_artists;
create trigger tattoo_artists_set_atualizado_em
before update on public.tattoo_artists
for each row execute function public.tg_set_atualizado_em();

drop policy if exists "Public read active tattoo_artists" on public.tattoo_artists;
create policy "Public read active tattoo_artists"
on public.tattoo_artists
for select
to anon, authenticated
using (ativo = true or public.is_admin());

drop policy if exists "Admins manage tattoo_artists" on public.tattoo_artists;
create policy "Admins manage tattoo_artists"
on public.tattoo_artists
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.tattoo_artists (nome, slug, ativo)
values
  ('Alef', 'alef', true),
  ('Alone', 'alone', true),
  ('Atila', 'atila', true),
  ('Formiga', 'formiga', true),
  ('Freestyle', 'freestyle', true),
  ('Gabriel GL', 'gabriel-gl', true),
  ('Grego', 'grego', true),
  ('Hendruway', 'hendruway', true),
  ('Hiago', 'hiago', true),
  ('Honorio', 'honorio', true),
  ('Johziano', 'johziano', true),
  ('Jonathan', 'jonathan', true),
  ('Kauany', 'kauany', true),
  ('Lara Molina', 'lara-molina', true),
  ('Lipe', 'lipe', true),
  ('Luana', 'luana', true),
  ('Marcos', 'marcos', true),
  ('Mateus Rattu', 'mateus-rattu', true),
  ('Natan', 'natan', true),
  ('PH Essenza', 'ph-essenza', true),
  ('Rafael Gomes', 'rafael-gomes', true),
  ('Rafael Voltagem', 'rafael-voltagem', true),
  ('Sarah Nicodemos', 'sarah-nicodemos', true),
  ('Strong', 'strong', true),
  ('Tal Preto', 'tal-preto', true),
  ('Thais Lisboa', 'thais-lisboa', true),
  ('Thiago Brito', 'thiago-brito', true),
  ('Thiago C Ink', 'thiago-c-ink', true)
on conflict (slug) do update
set nome = excluded.nome,
    ativo = true;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'branding',
  'branding',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
where not exists (
  select 1 from storage.buckets where id = 'branding'
);

drop policy if exists "Admins upload branding" on storage.objects;
create policy "Admins upload branding"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'branding' and public.is_admin());

drop policy if exists "Admins update branding" on storage.objects;
create policy "Admins update branding"
on storage.objects
for update
to authenticated
using (bucket_id = 'branding' and public.is_admin())
with check (bucket_id = 'branding' and public.is_admin());

drop policy if exists "Admins delete branding" on storage.objects;
create policy "Admins delete branding"
on storage.objects
for delete
to authenticated
using (bucket_id = 'branding' and public.is_admin());

insert into public.app_config (key, value)
values
  (
    'branding.v1',
    '{"systemName":"85 TATTOO Studio","logoPath":"","iconPath":"","backgroundPath":"","primaryColor":"#0A0A0A","accentColor":"#C8A951","surfaceColor":"#151515","pdfHeader":"85 TATTOO Studio","pdfFooter":"Documento emitido pelo painel administrativo."}'
  ),
  (
    'admin_profile.v1',
    '{"displayName":"Administrador","roleTitle":"Administrador responsavel","avatarPath":"","supportEmail":"","notes":""}'
  ),
  (
    'operation.v1',
    '{"businessHours":"Seg-Sab, 10h-19h","defaultSessionMinutes":120,"lateToleranceMinutes":15,"dailyCapacity":40,"queueStrategy":"ordem_de_chegada","checkinRules":"","paymentMethods":["pix","cartao","dinheiro"],"appointmentTypes":["primeira visita","retorno","avaliacao"],"rooms":["Sala 1"],"stations":["Estacao principal"],"recurrenceRules":""}'
  ),
  (
    'studio.v1',
    '{"nomeEstudio":"85 TATTOO Studio","nomeEmpresarial":"","documento":"","telefone":"","whatsapp":"","email":"","site":"","endereco":"","cidade":"","estado":"","cep":"","timezone":"America/Fortaleza","horario":"","descricao":"","lgpdEmail":"","privacyContactChannel":"","privacyResponsible":"","dpoName":"","privacyResponseDeadlineDays":15,"productionChecklistCompleted":false}'
  ),
  (
    'documents.v1',
    '{"filePrefix":"85-tattoo","fichaVersionLabel":"v1","pdfHeader":"85 TATTOO Studio","pdfFooter":"Documento gerado pelo sistema administrativo.","contractLead":"Termo de atendimento e responsabilidade.","ficheLead":"Ficha do cliente e anamnese.","consentLead":"Registro de consentimento LGPD.","namingPattern":"{prefix}-{tipo}-{cpfMasked}-{versao}-{data}","contractTemplateVersion":"2026-07-termo-v3","contractTemplateBody":"TERMO DE RESPONSABILIDADE E CIENCIA DO PROCEDIMENTO\n\nPartes:\n- Cliente/titular: {{client.nome}} (CPF {{client.cpf_masked}})\n- Profissional responsavel: {{artist.nome}}\n- Estabelecimento: {{studio.nome_empresarial}} / {{studio.nome_estudio}} - Documento {{studio.documento}}\n\nDados do atendimento:\n- Data do aceite: {{acceptance.date}}\n- Horario do aceite: {{acceptance.time}}\n- Identificacao do aceite: {{acceptance.id}}\n\nO cliente declara que forneceu informacoes veridicas sobre seu estado de saude, contatos e historico relevante. Informacoes incompletas ou inexatas podem comprometer a seguranca do atendimento.\n\nO profissional e o estabelecimento assumem deveres proprios de cuidado, higiene, orientacao, registro e conducao do procedimento dentro de suas atribuicoes. Este termo nao elimina responsabilidades legais, contratuais, regulatorias ou sanitarias aplicaveis.\n\nO procedimento envolve riscos inerentes, variacoes biologicas e necessidade de cuidados pre e pos-procedimento, conforme orientacao tecnica do profissional responsavel.\n\nCanal de contato institucional: {{studio.contact_channel}}\nCanal LGPD: {{studio.lgpd_email}}\nResponsavel pela privacidade: {{studio.privacy_responsible}}\nEncarregado/DPO: {{studio.dpo_name}}\nEndereco do estudio: {{studio.endereco_completo}}\n\nAo prosseguir com a assinatura, o cliente confirma leitura integral e concordancia com este termo na data e horario acima.","contractTemplateHistory":[{"version":"2026-07-termo-v3","body":"TERMO DE RESPONSABILIDADE E CIENCIA DO PROCEDIMENTO\n\nPartes:\n- Cliente/titular: {{client.nome}} (CPF {{client.cpf_masked}})\n- Profissional responsavel: {{artist.nome}}\n- Estabelecimento: {{studio.nome_empresarial}} / {{studio.nome_estudio}} - Documento {{studio.documento}}\n\nDados do atendimento:\n- Data do aceite: {{acceptance.date}}\n- Horario do aceite: {{acceptance.time}}\n- Identificacao do aceite: {{acceptance.id}}\n\nO cliente declara que forneceu informacoes veridicas sobre seu estado de saude, contatos e historico relevante. Informacoes incompletas ou inexatas podem comprometer a seguranca do atendimento.\n\nO profissional e o estabelecimento assumem deveres proprios de cuidado, higiene, orientacao, registro e conducao do procedimento dentro de suas atribuicoes. Este termo nao elimina responsabilidades legais, contratuais, regulatorias ou sanitarias aplicaveis.\n\nO procedimento envolve riscos inerentes, variacoes biologicas e necessidade de cuidados pre e pos-procedimento, conforme orientacao tecnica do profissional responsavel.\n\nCanal de contato institucional: {{studio.contact_channel}}\nCanal LGPD: {{studio.lgpd_email}}\nResponsavel pela privacidade: {{studio.privacy_responsible}}\nEncarregado/DPO: {{studio.dpo_name}}\nEndereco do estudio: {{studio.endereco_completo}}\n\nAo prosseguir com a assinatura, o cliente confirma leitura integral e concordancia com este termo na data e horario acima.","createdAt":"2026-07-20T00:00:00.000Z"}],"anamneseTemplateVersion":"2026-07-anamnese-v2","anamneseTemplateBody":"DECLARACAO DE CIENCIA DE RISCOS\n\nCliente: {{client.nome}} (CPF {{client.cpf_masked}})\nProfissional responsavel: {{artist.nome}}\nData do aceite: {{acceptance.date}} {{acceptance.time}}\n\nDeclaro estar informado(a) sobre possiveis complicacoes e cuidados associados ao procedimento, inclusive quanto a alergias, infeccoes, queloides, reacoes organicas, condicoes de saude preexistentes e necessidade de procurar servico de saude diante de sinais anormais.\n\nAlgumas condicoes podem exigir avaliacao medica previa, revisao administrativa adicional ou adiamento do procedimento.\n\nCanal de contato institucional: {{studio.contact_channel}}\nCanal LGPD: {{studio.lgpd_email}}","anamneseTemplateHistory":[{"version":"2026-07-anamnese-v2","body":"DECLARACAO DE CIENCIA DE RISCOS\n\nCliente: {{client.nome}} (CPF {{client.cpf_masked}})\nProfissional responsavel: {{artist.nome}}\nData do aceite: {{acceptance.date}} {{acceptance.time}}\n\nDeclaro estar informado(a) sobre possiveis complicacoes e cuidados associados ao procedimento, inclusive quanto a alergias, infeccoes, queloides, reacoes organicas, condicoes de saude preexistentes e necessidade de procurar servico de saude diante de sinais anormais.\n\nAlgumas condicoes podem exigir avaliacao medica previa, revisao administrativa adicional ou adiamento do procedimento.\n\nCanal de contato institucional: {{studio.contact_channel}}\nCanal LGPD: {{studio.lgpd_email}}","createdAt":"2026-07-20T00:00:00.000Z"}],"lgpdTemplateVersion":"2026-07-lgpd-v3","lgpdTemplateBody":"TRATAMENTO DE DADOS PESSOAIS E SENSIVEIS\n\nControlador:\n- Nome empresarial: {{studio.nome_empresarial}}\n- Nome fantasia: {{studio.nome_estudio}}\n- Documento: {{studio.documento}}\n- Endereco: {{studio.endereco_completo}}\n- Canal de contato: {{studio.contact_channel}}\n- Canal LGPD: {{studio.lgpd_email}}\n- Responsavel pela privacidade: {{studio.privacy_responsible}}\n- Encarregado/DPO: {{studio.dpo_name}}\n\nAo prosseguir, o titular confirma ciencia de que os dados cadastrais, de contato, de assinatura e de saude estritamente necessarios ao atendimento poderao ser coletados, armazenados e tratados para identificacao civil e operacional do atendimento, execucao segura do procedimento, cumprimento de obrigacoes legais, regulatorias, sanitarias e de guarda, alem de registro de consentimentos, auditoria, prevencao a fraude e seguranca da operacao.\n\nIdentificacao do aceite: {{acceptance.id}}\nData e horario do aceite: {{acceptance.datetime}}\nPrazo interno de resposta LGPD: {{studio.privacy_deadline_days}} dia(s).","lgpdTemplateHistory":[{"version":"2026-07-lgpd-v3","body":"TRATAMENTO DE DADOS PESSOAIS E SENSIVEIS\n\nControlador:\n- Nome empresarial: {{studio.nome_empresarial}}\n- Nome fantasia: {{studio.nome_estudio}}\n- Documento: {{studio.documento}}\n- Endereco: {{studio.endereco_completo}}\n- Canal de contato: {{studio.contact_channel}}\n- Canal LGPD: {{studio.lgpd_email}}\n- Responsavel pela privacidade: {{studio.privacy_responsible}}\n- Encarregado/DPO: {{studio.dpo_name}}\n\nAo prosseguir, o titular confirma ciencia de que os dados cadastrais, de contato, de assinatura e de saude estritamente necessarios ao atendimento poderao ser coletados, armazenados e tratados para identificacao civil e operacional do atendimento, execucao segura do procedimento, cumprimento de obrigacoes legais, regulatorias, sanitarias e de guarda, alem de registro de consentimentos, auditoria, prevencao a fraude e seguranca da operacao.\n\nIdentificacao do aceite: {{acceptance.id}}\nData e horario do aceite: {{acceptance.datetime}}\nPrazo interno de resposta LGPD: {{studio.privacy_deadline_days}} dia(s).","createdAt":"2026-07-20T00:00:00.000Z"}]}'
  )
on conflict (key) do nothing;

alter table public.consent_records
  add column if not exists finalidade text,
  add column if not exists contexto text,
  add column if not exists status text,
  add column if not exists consent_scope text,
  add column if not exists titular_ref text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists revogado_em timestamptz,
  add column if not exists document_type text,
  add column if not exists template_version text,
  add column if not exists template_hash text,
  add column if not exists rendered_text text,
  add column if not exists rendered_html text,
  add column if not exists config_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists client_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists artist_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by text,
  add column if not exists signature_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists source text,
  add column if not exists created_at timestamptz not null default now();

update public.consent_records
set
  metadata = coalesce(metadata, '{}'::jsonb),
  status = coalesce(nullif(status, ''), 'granted'),
  consent_scope = coalesce(nullif(consent_scope, ''), 'required'),
  accepted_at = coalesce(accepted_at, criado_em),
  created_at = coalesce(created_at, criado_em),
  template_version = coalesce(nullif(template_version, ''), nullif(versao, '')),
  document_type = coalesce(
    nullif(document_type, ''),
    case tipo
      when 'termo' then 'contract'
      when 'lgpd' then 'lgpd'
      when 'anamnese' then 'anamnese'
      when 'imagem' then 'image'
      else tipo
    end
  ),
  config_snapshot = coalesce(config_snapshot, '{}'::jsonb),
  client_snapshot = coalesce(client_snapshot, '{}'::jsonb),
  artist_snapshot = coalesce(artist_snapshot, '{}'::jsonb),
  signature_snapshot = coalesce(signature_snapshot, '{}'::jsonb)
where true;

create index if not exists consent_records_cpf_tipo_accepted_at_idx
  on public.consent_records (cpf, tipo, coalesce(accepted_at, criado_em) desc);

create index if not exists consent_records_document_type_idx
  on public.consent_records (document_type);

alter table public.consent_records enable row level security;

drop policy if exists "Admins read consent_records" on public.consent_records;
create policy "Admins read consent_records"
on public.consent_records
for select
to authenticated
using (public.is_admin());

drop policy if exists "Kiosk insert consent_records" on public.consent_records;
create policy "Kiosk insert consent_records"
on public.consent_records
for insert
to anon, authenticated
with check (true);

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
begin
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
    _ip,
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

create or replace function public.get_public_document_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_studio jsonb := coalesce(
    (select value::jsonb from public.app_config where key = 'studio.v1'),
    '{}'::jsonb
  );
  v_identity jsonb := coalesce(
    (select value::jsonb from public.app_config where key = 'branding.v1'),
    '{}'::jsonb
  );
  v_documents jsonb := coalesce(
    (select value::jsonb from public.app_config where key = 'documents.v1'),
    '{}'::jsonb
  );
  missing_fields text[] := array[]::text[];
begin
  if coalesce(nullif(v_studio->>'nomeEstudio', ''), '') = '' then
    missing_fields := array_append(missing_fields, 'nome comercial');
  end if;
  if coalesce(nullif(v_studio->>'nomeEmpresarial', ''), '') = '' then
    missing_fields := array_append(missing_fields, 'razao social');
  end if;
  if coalesce(nullif(v_studio->>'documento', ''), '') = '' then
    missing_fields := array_append(missing_fields, 'documento/CNPJ');
  end if;
  if coalesce(nullif(v_studio->>'endereco', ''), '') = '' then
    missing_fields := array_append(missing_fields, 'endereco');
  end if;
  if coalesce(nullif(v_studio->>'telefone', ''), '') = '' then
    missing_fields := array_append(missing_fields, 'telefone institucional');
  end if;
  if coalesce(nullif(v_studio->>'whatsapp', ''), '') = '' then
    missing_fields := array_append(missing_fields, 'WhatsApp institucional');
  end if;
  if coalesce(nullif(v_studio->>'email', ''), '') = '' then
    missing_fields := array_append(missing_fields, 'e-mail institucional');
  end if;
  if coalesce(nullif(v_studio->>'lgpdEmail', ''), '') = '' then
    missing_fields := array_append(missing_fields, 'e-mail LGPD');
  end if;
  if coalesce(nullif(v_studio->>'privacyContactChannel', ''), '') = '' then
    missing_fields := array_append(missing_fields, 'canal LGPD');
  end if;
  if coalesce(nullif(v_studio->>'privacyResponsible', ''), '') = '' then
    missing_fields := array_append(missing_fields, 'responsavel pela privacidade');
  end if;

  return jsonb_build_object(
    'studio', v_studio,
    'identity', v_identity,
    'documents', v_documents,
    'missingRequiredFields', to_jsonb(missing_fields),
    'legalReady', coalesce(array_length(missing_fields, 1), 0) = 0
  );
end;
$$;

grant execute on function public.get_public_document_context() to anon, authenticated, service_role;

commit;
