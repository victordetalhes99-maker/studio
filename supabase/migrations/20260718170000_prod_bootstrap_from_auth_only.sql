begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'app_role'
  ) then
    create type public.app_role as enum ('admin', 'gerente', 'recepcao');
  end if;
exception
  when duplicate_object then null;
end
$$;

alter type public.app_role add value if not exists 'gerente';
alter type public.app_role add value if not exists 'recepcao';

do $$
begin
  create type public.check_in_status as enum (
    'waiting',
    'called',
    'in_service',
    'completed',
    'cancelled',
    'no_show'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.check_in_event_kind as enum (
    'created',
    'called',
    'started',
    'completed',
    'cancelled',
    'no_show',
    'reordered',
    'note_added',
    'reopened'
  );
exception
  when duplicate_object then null;
end
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;

revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.has_role(auth.uid(), 'admin'::public.app_role),
    false
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

create or replace function public.tg_set_atualizado_em()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  cpf text not null unique,
  nome_completo text not null,
  telefone text,
  email text,
  tatuador text,
  dados_cadastrais jsonb not null default '{}'::jsonb,
  anamnese jsonb not null default '{}'::jsonb,
  assinatura text,
  sessoes jsonb not null default '[]'::jsonb,
  status text not null default 'aguardando',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  anamnese_enc bytea
);

grant select, insert, update, delete on public.clientes to authenticated;
grant insert on public.clientes to anon;
grant all on public.clientes to service_role;
create index if not exists clientes_criado_em_idx on public.clientes (criado_em desc);
create index if not exists clientes_tatuador_idx on public.clientes (tatuador);
alter table public.clientes enable row level security;

create or replace function public.tg_validate_cliente()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  is_anon boolean := (auth.uid() is null);
  birth_date text;
  birth_ts date;
  age_years integer;
begin
  new.cpf := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');
  if new.cpf !~ '^[0-9]{11}$' then
    raise exception 'CPF invalido';
  end if;

  new.nome_completo := btrim(coalesce(new.nome_completo, ''));
  if length(new.nome_completo) < 2 or length(new.nome_completo) > 200 then
    raise exception 'Nome invalido';
  end if;

  if new.telefone is not null and length(new.telefone) > 32 then
    raise exception 'Telefone longo';
  end if;
  if new.email is not null and length(new.email) > 254 then
    raise exception 'E-mail longo';
  end if;
  if new.tatuador is not null and length(new.tatuador) > 120 then
    raise exception 'Tatuador invalido';
  end if;
  if pg_column_size(new.dados_cadastrais) > 16384 then
    raise exception 'dados grandes';
  end if;
  if pg_column_size(new.anamnese) > 16384 then
    raise exception 'anamnese grande';
  end if;
  if pg_column_size(new.sessoes) > 20971520 then
    raise exception 'sessoes grandes';
  end if;
  if new.assinatura is not null and length(new.assinatura) > 2000000 then
    raise exception 'assinatura grande';
  end if;

  birth_date := coalesce(new.dados_cadastrais->>'dataNascimento', '');
  if birth_date <> '' then
    birth_ts := birth_date::date;
    age_years := date_part('year', age(current_date, birth_ts));
    new.dados_cadastrais := jsonb_set(
      coalesce(new.dados_cadastrais, '{}'::jsonb),
      '{idadeCalculada}',
      to_jsonb(age_years),
      true
    );
    new.dados_cadastrais := jsonb_set(
      coalesce(new.dados_cadastrais, '{}'::jsonb),
      '{faixaEtaria}',
      to_jsonb(case when age_years < 18 then 'menor' else 'adulto' end),
      true
    );
    new.dados_cadastrais := jsonb_set(
      coalesce(new.dados_cadastrais, '{}'::jsonb),
      '{guardianValidationStatus}',
      to_jsonb(case when age_years < 18 then 'pending' else 'not_required' end),
      true
    );
    if age_years < 18 then
      new.status := 'pendente_responsavel';
    end if;
  end if;

  if is_anon then
    new.criado_em := now();
    new.atualizado_em := now();
    if new.status not in ('aguardando', 'pendente_responsavel') then
      new.status := 'aguardando';
    end if;
  end if;

  if new.status not in ('aguardando', 'atendido', 'pendente_responsavel') then
    raise exception 'Status invalido';
  end if;

  return new;
end;
$$;

drop trigger if exists clientes_set_atualizado_em on public.clientes;
create trigger clientes_set_atualizado_em
before update on public.clientes
for each row execute function public.tg_set_atualizado_em();

drop trigger if exists validate_cliente_biu on public.clientes;
create trigger validate_cliente_biu
before insert or update on public.clientes
for each row execute function public.tg_validate_cliente();

drop policy if exists "Public check-in insert" on public.clientes;
create policy "Public check-in insert"
on public.clientes
for insert
to anon, authenticated
with check (
  cpf ~ '^[0-9]{11}$'
  and length(nome_completo) between 2 and 200
  and status in ('aguardando', 'pendente_responsavel')
);

drop policy if exists "Admins read clientes" on public.clientes;
create policy "Admins read clientes"
on public.clientes
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins update clientes" on public.clientes;
create policy "Admins update clientes"
on public.clientes
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins delete clientes" on public.clientes;
create policy "Admins delete clientes"
on public.clientes
for delete
to authenticated
using (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'assinaturas',
  'assinaturas',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
where not exists (
  select 1 from storage.buckets where id = 'assinaturas'
);

drop policy if exists "Public upload assinatura" on storage.objects;
create policy "Public upload assinatura"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'assinaturas'
  and lower(storage.extension(name)) in ('png', 'jpg', 'jpeg', 'webp')
  and octet_length(coalesce(name, '')) <= 256
);

drop policy if exists "Admins read assinaturas" on storage.objects;
create policy "Admins read assinaturas"
on storage.objects
for select
to authenticated
using (bucket_id = 'assinaturas' and public.is_admin());

drop policy if exists "Admins update assinaturas" on storage.objects;
create policy "Admins update assinaturas"
on storage.objects
for update
to authenticated
using (bucket_id = 'assinaturas' and public.is_admin());

drop policy if exists "Admins delete assinaturas" on storage.objects;
create policy "Admins delete assinaturas"
on storage.objects
for delete
to authenticated
using (bucket_id = 'assinaturas' and public.is_admin());

create or replace function public.checkin_get_cliente(_cpf text)
returns table (cpf text, nome_completo text, tatuador text)
language sql
stable
security definer
set search_path = public
as $$
  select c.cpf, c.nome_completo, c.tatuador
  from public.clientes c
  where c.cpf = regexp_replace(coalesce(_cpf, ''), '\D', '', 'g')
  limit 1;
$$;

grant execute on function public.checkin_get_cliente(text) to anon, authenticated;

create or replace function public.checkin_append_sessao(
  _cpf text,
  _sessao jsonb,
  _anamnese jsonb default null,
  _tatuador text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cpf_d text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
begin
  if octet_length(coalesce(_sessao::text, '')) > 1048576 then
    raise exception 'Sessao grande';
  end if;

  update public.clientes
     set sessoes = coalesce(sessoes, '[]'::jsonb) || coalesce(_sessao, '{}'::jsonb),
         anamnese = coalesce(_anamnese, anamnese),
         tatuador = coalesce(nullif(trim(_tatuador), ''), tatuador),
         dados_cadastrais = case
           when nullif(trim(_tatuador), '') is not null then
             jsonb_set(coalesce(dados_cadastrais, '{}'::jsonb), '{tatuador}', to_jsonb(trim(_tatuador)), true)
           else dados_cadastrais
         end,
         atualizado_em = now()
   where cpf = cpf_d;

  if not found then
    raise exception 'cliente nao encontrado';
  end if;
end;
$$;

grant execute on function public.checkin_append_sessao(text, jsonb, jsonb, text) to anon, authenticated;

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  cpf text not null,
  tipo text not null,
  versao text not null default 'v1',
  texto_hash text not null,
  finalidade text,
  contexto text,
  status text not null default 'granted',
  consent_scope text not null default 'required',
  titular_ref text,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text,
  device jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  revogado_em timestamptz,
  constraint consent_records_status_check check (status in ('granted', 'denied', 'revoked')),
  constraint consent_records_scope_check check (consent_scope in ('required', 'optional'))
);

create index if not exists consent_records_cpf_idx on public.consent_records(cpf);
create index if not exists consent_records_criado_em_idx on public.consent_records(criado_em desc);
grant insert on public.consent_records to anon, authenticated;
grant select on public.consent_records to authenticated;
grant all on public.consent_records to service_role;
alter table public.consent_records enable row level security;

drop policy if exists "Public consent insert" on public.consent_records;
create policy "Public consent insert"
on public.consent_records
for insert
to anon, authenticated
with check (
  cpf ~ '^[0-9]{11}$'
  and tipo in ('lgpd', 'termo', 'anamnese', 'imagem')
  and length(texto_hash) between 8 and 128
  and status in ('granted', 'denied', 'revoked')
  and consent_scope in ('required', 'optional')
);

drop policy if exists "Admins read consent" on public.consent_records;
create policy "Admins read consent"
on public.consent_records
for select
to authenticated
using (public.is_admin());

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  acao text not null,
  cliente_cpf text,
  detalhes jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text,
  criado_em timestamptz not null default now()
);

grant select on public.admin_audit_log to authenticated;
grant all on public.admin_audit_log to service_role;
alter table public.admin_audit_log enable row level security;

drop policy if exists "Admins read audit" on public.admin_audit_log;
create policy "Admins read audit"
on public.admin_audit_log
for select
to authenticated
using (public.is_admin());

create table if not exists public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  cpf text not null,
  email text,
  tipo text not null,
  motivo text,
  status text not null default 'pendente',
  resposta text,
  ip text,
  user_agent text,
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por uuid,
  protocolo text,
  operation_id text,
  verification_status text not null default 'verificacao_pendente',
  verification_token_hash text,
  verification_expires_at timestamptz,
  verification_attempts integer not null default 0,
  decision text,
  decision_reason text,
  affected_records jsonb not null default '[]'::jsonb,
  decided_by uuid,
  decision_at timestamptz,
  due_at timestamptz not null default (now() + interval '15 days'),
  constraint data_subject_requests_tipo_check check (tipo in ('delete', 'anonymize', 'export', 'rectify')),
  constraint data_subject_requests_status_check check (
    status in ('pendente', 'em_analise', 'respondido', 'concluido', 'negado', 'cancelado')
  ),
  constraint data_subject_requests_verification_status_check check (
    verification_status in ('verificacao_pendente', 'verificado', 'expirado', 'negado')
  )
);

create unique index if not exists idx_data_subject_requests_protocolo
  on public.data_subject_requests (protocolo);

grant insert on public.data_subject_requests to anon, authenticated;
grant select, update on public.data_subject_requests to authenticated;
grant all on public.data_subject_requests to service_role;
alter table public.data_subject_requests enable row level security;

drop policy if exists "Public DSR insert" on public.data_subject_requests;
create policy "Public DSR insert"
on public.data_subject_requests
for insert
to anon, authenticated
with check (
  cpf ~ '^[0-9]{11}$'
  and tipo in ('delete', 'anonymize', 'export', 'rectify')
  and status = 'pendente'
);

drop policy if exists "Admins read DSR" on public.data_subject_requests;
create policy "Admins read DSR"
on public.data_subject_requests
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins update DSR" on public.data_subject_requests;
create policy "Admins update DSR"
on public.data_subject_requests
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.tg_data_subject_requests_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.cpf is not null then
    new.cpf := regexp_replace(new.cpf, '\D', '', 'g');
  end if;
  if new.protocolo is null or new.protocolo = '' then
    new.protocolo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  end if;
  if new.status is null or new.status = '' then
    new.status := 'pendente';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_data_subject_requests_defaults on public.data_subject_requests;
create trigger trg_data_subject_requests_defaults
before insert or update on public.data_subject_requests
for each row execute function public.tg_data_subject_requests_defaults();

create table if not exists public.data_subject_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.data_subject_requests(id) on delete cascade,
  actor_id uuid,
  event_kind text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant select, insert on public.data_subject_request_events to authenticated;
grant all on public.data_subject_request_events to service_role;
alter table public.data_subject_request_events enable row level security;

drop policy if exists "Admins read DSR events" on public.data_subject_request_events;
create policy "Admins read DSR events"
on public.data_subject_request_events
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins insert DSR events" on public.data_subject_request_events;
create policy "Admins insert DSR events"
on public.data_subject_request_events
for insert
to authenticated
with check (public.is_admin());

create table if not exists public.rate_limit_buckets (
  bucket_key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket_key, window_start)
);

grant all on public.rate_limit_buckets to service_role;
alter table public.rate_limit_buckets enable row level security;

drop policy if exists "Deny all" on public.rate_limit_buckets;
create policy "Deny all"
on public.rate_limit_buckets
for all
to anon, authenticated
using (false)
with check (false);

create or replace function public.registrar_consentimento(
  _cpf text,
  _tipo text,
  _texto_hash text,
  _versao text default 'v1',
  _finalidade text default null,
  _contexto text default null,
  _status text default 'granted',
  _consent_scope text default 'required',
  _titular_ref text default null,
  _metadata jsonb default '{}'::jsonb,
  _ip text default null,
  _user_agent text default null,
  _device jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  d text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  new_id uuid;
begin
  if d !~ '^[0-9]{11}$' then
    raise exception 'CPF invalido';
  end if;
  if _tipo not in ('lgpd', 'termo', 'anamnese', 'imagem') then
    raise exception 'Tipo invalido';
  end if;
  if coalesce(_status, '') not in ('granted', 'denied', 'revoked') then
    raise exception 'Status invalido';
  end if;
  if coalesce(_consent_scope, '') not in ('required', 'optional') then
    raise exception 'Escopo invalido';
  end if;

  insert into public.consent_records(
    cpf, tipo, versao, texto_hash, finalidade, contexto, status, consent_scope,
    titular_ref, metadata, ip, user_agent, device, revogado_em
  )
  values (
    d,
    _tipo,
    coalesce(_versao, 'v1'),
    _texto_hash,
    nullif(btrim(coalesce(_finalidade, '')), ''),
    nullif(btrim(coalesce(_contexto, '')), ''),
    coalesce(_status, 'granted'),
    coalesce(_consent_scope, 'required'),
    nullif(btrim(coalesce(_titular_ref, '')), ''),
    coalesce(_metadata, '{}'::jsonb),
    left(coalesce(_ip, ''), 64),
    left(coalesce(_user_agent, ''), 1024),
    coalesce(_device, '{}'::jsonb),
    case when _status = 'revoked' then now() else null end
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.registrar_consentimento(
  text, text, text, text, text, text, text, text, text, jsonb, text, text, jsonb
) to anon, authenticated;

create or replace function public.rate_limit_check(_key text, _max integer, _window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  win_start timestamptz;
  cur_count integer;
begin
  if _key is null or length(_key) = 0 or length(_key) > 200 then
    raise exception 'Chave invalida';
  end if;
  if _max <= 0 or _max > 10000 then
    raise exception 'Limite invalido';
  end if;
  if _window_seconds <= 0 or _window_seconds > 86400 then
    raise exception 'Janela invalida';
  end if;

  win_start := date_trunc('second', now()) -
    (extract(epoch from now())::bigint % _window_seconds) * interval '1 second';

  delete from public.rate_limit_buckets
   where window_start < now() - interval '1 day';

  insert into public.rate_limit_buckets(bucket_key, window_start, count)
  values (_key, win_start, 1)
  on conflict (bucket_key, window_start)
  do update set count = public.rate_limit_buckets.count + 1
  returning count into cur_count;

  return cur_count <= _max;
end;
$$;

grant execute on function public.rate_limit_check(text, integer, integer) to anon, authenticated;

create or replace function public.log_admin_action(
  _acao text,
  _cliente_cpf text default null,
  _detalhes jsonb default '{}'::jsonb,
  _ip text default null,
  _user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then
    raise exception 'Nao autenticado';
  end if;
  if not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;
  if _acao not in ('view_cliente', 'edit_cliente', 'export', 'delete', 'anonymize', 'unmask', 'login', 'dsr_resolve') then
    raise exception 'Acao invalida';
  end if;

  insert into public.admin_audit_log(admin_id, acao, cliente_cpf, detalhes, ip, user_agent)
  values (
    uid,
    _acao,
    nullif(regexp_replace(coalesce(_cliente_cpf, ''), '\D', '', 'g'), ''),
    coalesce(_detalhes, '{}'::jsonb),
    left(coalesce(_ip, ''), 64),
    left(coalesce(_user_agent, ''), 1024)
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.log_admin_action(text, text, jsonb, text, text) to authenticated;

create or replace function public.anonymize_cliente(_cpf text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  hashed text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;
  if d !~ '^[0-9]{11}$' then
    raise exception 'CPF invalido';
  end if;

  hashed := encode(digest('lgpd:' || d, 'sha256'), 'hex');

  update public.clientes
     set nome_completo = 'Titular Anonimizado',
         telefone = null,
         email = null,
         dados_cadastrais = jsonb_build_object(
           'anonimizado', true,
           'anonimizadoEm', to_jsonb(now()),
           'cpfHash', to_jsonb(hashed)
         ),
         anamnese = '{}'::jsonb,
         anamnese_enc = null,
         assinatura = null,
         sessoes = '[]'::jsonb,
         status = 'atendido',
         atualizado_em = now()
   where cpf = d;

  if not found then
    raise exception 'Cliente nao encontrado';
  end if;

  insert into public.admin_audit_log(admin_id, acao, cliente_cpf, detalhes)
  values (auth.uid(), 'anonymize', d, jsonb_build_object('cpfHash', hashed));
end;
$$;

grant execute on function public.anonymize_cliente(text) to authenticated;

create or replace function public.delete_cliente_lgpd(_cpf text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;
  if d !~ '^[0-9]{11}$' then
    raise exception 'CPF invalido';
  end if;

  insert into public.admin_audit_log(admin_id, acao, cliente_cpf, detalhes)
  values (auth.uid(), 'delete', d, jsonb_build_object('motivo', 'lgpd'));

  delete from public.clientes where cpf = d;
end;
$$;

grant execute on function public.delete_cliente_lgpd(text) to authenticated;

create table if not exists public.retention_rules (
  id uuid primary key default gen_random_uuid(),
  data_category text not null unique,
  finalidade text not null,
  prazo_dias integer,
  inicio_contagem text not null,
  acao_apos_prazo text not null,
  hipotese_conservacao text,
  responsavel text,
  review_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.retention_rules to authenticated;
grant all on public.retention_rules to service_role;
alter table public.retention_rules enable row level security;

drop policy if exists "Admins gerenciam retention_rules" on public.retention_rules;
create policy "Admins gerenciam retention_rules"
on public.retention_rules
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.retention_rules (
  data_category, finalidade, prazo_dias, inicio_contagem, acao_apos_prazo, hipotese_conservacao, responsavel
)
values
  ('cadastros', 'Identificacao e continuidade operacional', 3650, 'ultima_interacao', 'revisao_administrativa', 'Obrigacao legal ou exercicio regular de direitos', 'Administracao'),
  ('fichas_saude', 'Triagem e seguranca do procedimento', 3650, 'ultima_sessao', 'bloqueio_ou_anonimizacao', 'Tutela da saude e obrigacoes sanitarias', 'Responsavel tecnico'),
  ('contratos_termos', 'Prova documental e auditoria', 3650, 'aceite', 'arquivamento_restrito', 'Exercicio regular de direitos', 'Administracao'),
  ('imagens', 'Registro tecnico e uso opcional de imagem', 365, 'revogacao_ou_ultima_utilizacao', 'revisao_administrativa', 'Conservacao minima para defesa ou obrigacao aplicavel', 'Marketing/Administracao'),
  ('solicitacoes_lgpd', 'Atendimento ao titular e prova de decisao', 1825, 'encerramento', 'arquivamento_restrito', 'Exercicio regular de direitos', 'Privacidade')
on conflict (data_category) do nothing;

create table if not exists public.guardian_validations (
  id uuid primary key default gen_random_uuid(),
  cliente_cpf text not null,
  responsavel_nome text,
  responsavel_contato text,
  validation_status text not null default 'pending',
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

grant select, insert, update on public.guardian_validations to authenticated;
grant all on public.guardian_validations to service_role;
alter table public.guardian_validations enable row level security;

drop policy if exists "Admins gerenciam guardian_validations" on public.guardian_validations;
create policy "Admins gerenciam guardian_validations"
on public.guardian_validations
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.app_config (
  key text primary key,
  value text,
  atualizado_em timestamptz not null default now()
);

grant select, insert, update, delete on public.app_config to authenticated;
grant all on public.app_config to service_role;
alter table public.app_config enable row level security;

drop policy if exists "Admins app_config select" on public.app_config;
create policy "Admins app_config select"
on public.app_config
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins app_config insert" on public.app_config;
create policy "Admins app_config insert"
on public.app_config
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins app_config update" on public.app_config;
create policy "Admins app_config update"
on public.app_config
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.backup_logs (
  id uuid primary key default gen_random_uuid(),
  status text not null,
  mensagem text,
  spreadsheet_id text,
  spreadsheet_url text,
  csv_tab text,
  total_clientes integer,
  duracao_ms integer,
  detalhes jsonb not null default '{}'::jsonb,
  iniciado_em timestamptz not null default now(),
  concluido_em timestamptz not null default now()
);

grant select on public.backup_logs to authenticated;
grant all on public.backup_logs to service_role;
alter table public.backup_logs enable row level security;

drop policy if exists "Admins read backup_logs" on public.backup_logs;
create policy "Admins read backup_logs"
on public.backup_logs
for select
to authenticated
using (public.is_admin());

create or replace function public.latest_backup_status()
returns table (
  status text,
  mensagem text,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  spreadsheet_url text,
  total_clientes integer,
  duracao_ms integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    status,
    mensagem,
    iniciado_em,
    concluido_em,
    spreadsheet_url,
    total_clientes,
    duracao_ms
  from public.backup_logs
  order by iniciado_em desc
  limit 1;
$$;

grant execute on function public.latest_backup_status() to authenticated;

create table if not exists public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text,
  ip text,
  user_agent text,
  success boolean not null default false,
  criado_em timestamptz not null default now()
);

create index if not exists login_attempts_email_idx on public.login_attempts(email, criado_em desc);
create index if not exists login_attempts_ip_idx on public.login_attempts(ip, criado_em desc);
grant select on public.login_attempts to authenticated;
grant all on public.login_attempts to service_role;
alter table public.login_attempts enable row level security;

drop policy if exists "Admins read login_attempts" on public.login_attempts;
create policy "Admins read login_attempts"
on public.login_attempts
for select
to authenticated
using (public.is_admin());

create table if not exists public.abuse_logs (
  id uuid primary key default gen_random_uuid(),
  rota text,
  ip text,
  motivo text not null,
  detalhes jsonb not null default '{}'::jsonb,
  user_agent text,
  criado_em timestamptz not null default now()
);

grant select on public.abuse_logs to authenticated;
grant all on public.abuse_logs to service_role;
alter table public.abuse_logs enable row level security;

drop policy if exists "Admins read abuse_logs" on public.abuse_logs;
create policy "Admins read abuse_logs"
on public.abuse_logs
for select
to authenticated
using (public.is_admin());

create or replace function public.check_login_lockout(_email text, _ip text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e text := lower(btrim(coalesce(_email, '')));
  ip_v text := left(coalesce(_ip, ''), 64);
  fails_email integer;
  fails_ip integer;
  last_fail timestamptz;
  locked_until timestamptz;
begin
  select count(*) into fails_ip
  from public.login_attempts
  where ip = ip_v
    and success = false
    and criado_em > now() - interval '1 minute';

  if fails_ip >= 5 then
    return jsonb_build_object('locked', true, 'reason', 'rate_limit_ip', 'retry_after_seconds', 60);
  end if;

  select count(*), max(criado_em)
    into fails_email, last_fail
  from public.login_attempts
  where email = e
    and criado_em > now() - interval '15 minutes'
    and criado_em > coalesce(
      (select max(criado_em) from public.login_attempts where email = e and success = true),
      'epoch'::timestamptz
    );

  if fails_email >= 5 then
    locked_until := last_fail + interval '15 minutes';
    if locked_until > now() then
      return jsonb_build_object(
        'locked', true,
        'reason', 'lockout_email',
        'retry_after_seconds', greatest(1, extract(epoch from locked_until - now())::integer)
      );
    end if;
  end if;

  return jsonb_build_object('locked', false);
end;
$$;

grant execute on function public.check_login_lockout(text, text) to anon, authenticated;

create or replace function public.record_login_attempt(
  _email text,
  _ip text,
  _success boolean,
  _user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.login_attempts(email, ip, user_agent, success)
  values (
    lower(btrim(coalesce(_email, ''))),
    left(coalesce(_ip, ''), 64),
    left(coalesce(_user_agent, ''), 1024),
    coalesce(_success, false)
  );

  delete from public.login_attempts
   where criado_em < now() - interval '7 days';
end;
$$;

grant execute on function public.record_login_attempt(text, text, boolean, text) to anon, authenticated;

create or replace function public.record_abuse(
  _rota text,
  _ip text,
  _motivo text,
  _detalhes jsonb default '{}'::jsonb,
  _user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if _motivo is null or length(_motivo) = 0 or length(_motivo) > 80 then
    raise exception 'Motivo invalido';
  end if;

  insert into public.abuse_logs(rota, ip, motivo, detalhes, user_agent)
  values (
    left(coalesce(_rota, ''), 200),
    left(coalesce(_ip, ''), 64),
    _motivo,
    coalesce(_detalhes, '{}'::jsonb),
    left(coalesce(_user_agent, ''), 1024)
  )
  returning id into new_id;

  delete from public.abuse_logs
   where criado_em < now() - interval '30 days';

  return new_id;
end;
$$;

grant execute on function public.record_abuse(text, text, text, jsonb, text) to anon, authenticated;

create table if not exists public.backup_destinations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('r2', 'google_drive', 'local')),
  label text not null,
  config_masked jsonb not null default '{}'::jsonb,
  secret_refs jsonb not null default '{}'::jsonb,
  status text not null default 'nao_configurado'
    check (status in ('nao_configurado', 'configuracao_incompleta', 'conectado', 'erro', 'desativado')),
  last_tested_at timestamptz,
  last_error text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null
);

grant select, insert, update, delete on public.backup_destinations to authenticated;
grant all on public.backup_destinations to service_role;
alter table public.backup_destinations enable row level security;

drop trigger if exists trg_backup_destinations_updated on public.backup_destinations;
create trigger trg_backup_destinations_updated
before update on public.backup_destinations
for each row execute function public.tg_set_atualizado_em();

drop policy if exists "Admins gerenciam destinos" on public.backup_destinations;
create policy "Admins gerenciam destinos"
on public.backup_destinations
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.backup_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique,
  auto_enabled boolean not null default false,
  frequency text not null default 'diario'
    check (frequency in ('diario', 'semanal', 'mensal', 'personalizado', 'desativado')),
  hour smallint not null default 3 check (hour between 0 and 23),
  timezone text not null default 'America/Sao_Paulo',
  retention_daily smallint not null default 7,
  retention_weekly smallint not null default 4,
  retention_monthly smallint not null default 6,
  retention_yearly smallint not null default 1,
  content jsonb not null default '{
    "clientes": true,
    "tatuadores": true,
    "fichas": true,
    "contratos": true,
    "assinaturas": true,
    "check_ins": true,
    "documentos": true,
    "configuracoes": true,
    "logs": false
  }'::jsonb,
  encryption_enabled boolean not null default false,
  encryption_version text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

grant select, insert, update, delete on public.backup_settings to authenticated;
grant all on public.backup_settings to service_role;
alter table public.backup_settings enable row level security;

drop trigger if exists trg_backup_settings_updated on public.backup_settings;
create trigger trg_backup_settings_updated
before update on public.backup_settings
for each row execute function public.tg_set_atualizado_em();

drop policy if exists "Admins gerenciam politica" on public.backup_settings;
create policy "Admins gerenciam politica"
on public.backup_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.backup_settings (singleton)
select true
where not exists (
  select 1 from public.backup_settings where singleton = true
);

create table if not exists public.backup_jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('completo', 'banco', 'documentos', 'incremental', 'manual')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'partial', 'failed', 'cancelado', 'validando')),
  destination_id uuid references public.backup_destinations(id) on delete set null,
  destination_kind text,
  stage text,
  progress_stages jsonb not null default '[]'::jsonb,
  content jsonb not null default '{}'::jsonb,
  size_bytes bigint,
  duration_ms integer,
  checksum_sha256 text,
  manifest jsonb,
  storage_path text,
  error_message text,
  warnings jsonb not null default '[]'::jsonb,
  registros_incluidos integer,
  arquivos_incluidos integer,
  system_version text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  criado_por uuid references auth.users(id) on delete set null
);

create index if not exists idx_backup_jobs_started_at on public.backup_jobs (started_at desc);
create index if not exists idx_backup_jobs_status on public.backup_jobs (status);
grant select, insert, update, delete on public.backup_jobs to authenticated;
grant all on public.backup_jobs to service_role;
alter table public.backup_jobs enable row level security;

drop policy if exists "Admins gerenciam jobs" on public.backup_jobs;
create policy "Admins gerenciam jobs"
on public.backup_jobs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.restore_jobs (
  id uuid primary key default gen_random_uuid(),
  backup_job_id uuid references public.backup_jobs(id) on delete set null,
  status text not null default 'preview'
    check (status in ('preview', 'aguardando_confirmacao', 'running', 'completed', 'failed', 'cancelado', 'bloqueado')),
  scope text not null default 'completo'
    check (scope in ('completo', 'banco', 'documentos', 'configuracoes', 'parcial', 'cliente')),
  preview jsonb,
  impact jsonb,
  snapshot_job_id uuid references public.backup_jobs(id) on delete set null,
  error_message text,
  requested_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

grant select, insert, update, delete on public.restore_jobs to authenticated;
grant all on public.restore_jobs to service_role;
alter table public.restore_jobs enable row level security;

drop policy if exists "Admins gerenciam restauracao" on public.restore_jobs;
create policy "Admins gerenciam restauracao"
on public.restore_jobs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.backup_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor uuid references auth.users(id) on delete set null,
  action text not null,
  target_kind text,
  target_id uuid,
  ip text,
  user_agent text,
  details jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists idx_backup_audit_criado_em on public.backup_audit_log (criado_em desc);
grant select, insert on public.backup_audit_log to authenticated;
grant all on public.backup_audit_log to service_role;
alter table public.backup_audit_log enable row level security;

drop policy if exists "Admins leem auditoria" on public.backup_audit_log;
create policy "Admins leem auditoria"
on public.backup_audit_log
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins inserem auditoria" on public.backup_audit_log;
create policy "Admins inserem auditoria"
on public.backup_audit_log
for insert
to authenticated
with check (public.is_admin() and actor = auth.uid());

create or replace view public.backup_overview
with (security_invoker = true)
as
select
  (select count(*) from public.backup_destinations where status = 'conectado') as destinos_conectados,
  (select count(*) from public.backup_destinations) as destinos_total,
  (
    select jsonb_build_object(
      'id', id,
      'type', type,
      'status', status,
      'size_bytes', size_bytes,
      'duration_ms', duration_ms,
      'started_at', started_at,
      'completed_at', completed_at,
      'checksum_sha256', checksum_sha256,
      'destination_kind', destination_kind
    )
    from public.backup_jobs
    where status in ('completed', 'partial')
    order by started_at desc
    limit 1
  ) as ultimo_backup,
  (select auto_enabled from public.backup_settings where singleton) as auto_enabled,
  (select encryption_enabled from public.backup_settings where singleton) as encryption_enabled;

grant select on public.backup_overview to authenticated;

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  cpf text not null,
  cliente_nome text not null,
  tatuador text,
  status public.check_in_status not null default 'waiting',
  arrival_at timestamptz not null default now(),
  called_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  no_show_at timestamptz,
  queue_day date not null default (now() at time zone 'America/Fortaleza')::date,
  queue_position integer not null default 0,
  risk_flag boolean not null default false,
  risk_reasons text[] not null default '{}',
  has_ficha boolean not null default false,
  has_assinatura boolean not null default false,
  observacoes text,
  session_index integer,
  created_by uuid,
  updated_by uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint check_ins_cpf_fmt check (cpf ~ '^[0-9]{11}$'),
  constraint check_ins_cancel_reason_len check (cancel_reason is null or length(cancel_reason) between 3 and 500),
  constraint check_ins_obs_len check (observacoes is null or length(observacoes) <= 1000)
);

create index if not exists idx_check_ins_day_status on public.check_ins(queue_day, status);
create index if not exists idx_check_ins_cpf on public.check_ins(cpf);
create index if not exists idx_check_ins_tatuador on public.check_ins(tatuador);
create index if not exists idx_check_ins_arrival on public.check_ins(arrival_at desc);
create unique index if not exists uq_check_ins_open_per_cpf_day
  on public.check_ins(cpf, queue_day)
  where status in ('waiting', 'called', 'in_service');

grant select, insert, update, delete on public.check_ins to authenticated;
grant all on public.check_ins to service_role;
alter table public.check_ins enable row level security;

drop trigger if exists tg_check_ins_updated on public.check_ins;
create trigger tg_check_ins_updated
before update on public.check_ins
for each row execute function public.tg_set_atualizado_em();

drop policy if exists "admins read check_ins" on public.check_ins;
create policy "admins read check_ins"
on public.check_ins
for select
to authenticated
using (public.is_admin());

drop policy if exists "admins insert check_ins" on public.check_ins;
create policy "admins insert check_ins"
on public.check_ins
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "admins update check_ins" on public.check_ins;
create policy "admins update check_ins"
on public.check_ins
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins delete check_ins" on public.check_ins;
create policy "admins delete check_ins"
on public.check_ins
for delete
to authenticated
using (public.is_admin());

create table if not exists public.check_in_events (
  id uuid primary key default gen_random_uuid(),
  check_in_id uuid not null references public.check_ins(id) on delete cascade,
  kind public.check_in_event_kind not null,
  from_status public.check_in_status,
  to_status public.check_in_status,
  actor_id uuid,
  motivo text,
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists idx_check_in_events_check_in on public.check_in_events(check_in_id, criado_em);
grant select, insert on public.check_in_events to authenticated;
grant all on public.check_in_events to service_role;
alter table public.check_in_events enable row level security;

drop policy if exists "admins read check_in_events" on public.check_in_events;
create policy "admins read check_in_events"
on public.check_in_events
for select
to authenticated
using (public.is_admin());

drop policy if exists "admins insert check_in_events" on public.check_in_events;
create policy "admins insert check_in_events"
on public.check_in_events
for insert
to authenticated
with check (public.is_admin());

create or replace function public.tg_check_ins_log_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k public.check_in_event_kind;
begin
  if tg_op = 'INSERT' then
    insert into public.check_in_events(check_in_id, kind, to_status, actor_id)
    values (new.id, 'created', new.status, new.created_by);
    return new;
  end if;

  if new.status is distinct from old.status then
    k := case new.status
      when 'called' then 'called'
      when 'in_service' then 'started'
      when 'completed' then 'completed'
      when 'cancelled' then 'cancelled'
      when 'no_show' then 'no_show'
      when 'waiting' then 'reopened'
      else 'note_added'
    end;

    insert into public.check_in_events(check_in_id, kind, from_status, to_status, actor_id, motivo)
    values (
      new.id,
      k,
      old.status,
      new.status,
      new.updated_by,
      case when new.status = 'cancelled' then new.cancel_reason else null end
    );
  end if;

  return new;
end;
$$;

create or replace function public.tg_check_ins_validate()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.cpf := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');
  if new.cpf !~ '^[0-9]{11}$' then
    raise exception 'CPF invalido';
  end if;
  new.cliente_nome := btrim(coalesce(new.cliente_nome, ''));
  if length(new.cliente_nome) < 2 then
    raise exception 'Nome do cliente invalido';
  end if;
  if new.tatuador is not null and length(new.tatuador) > 120 then
    raise exception 'Tatuador invalido';
  end if;

  if tg_op = 'UPDATE' then
    if old.status = new.status then
      return new;
    end if;

    if not (
      (old.status = 'waiting' and new.status in ('called', 'cancelled', 'no_show', 'in_service')) or
      (old.status = 'called' and new.status in ('in_service', 'waiting', 'cancelled', 'no_show')) or
      (old.status = 'in_service' and new.status in ('completed', 'cancelled')) or
      (old.status = 'no_show' and new.status in ('waiting')) or
      (old.status = 'cancelled' and new.status in ('waiting'))
    ) then
      raise exception 'Transicao de status invalida: % -> %', old.status, new.status;
    end if;

    if new.status = 'cancelled' and (new.cancel_reason is null or length(btrim(new.cancel_reason)) < 3) then
      raise exception 'Motivo do cancelamento e obrigatorio';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tg_check_ins_log_event on public.check_ins;
create trigger tg_check_ins_log_event
after insert or update on public.check_ins
for each row execute function public.tg_check_ins_log_event();

drop trigger if exists tg_check_ins_validate on public.check_ins;
create trigger tg_check_ins_validate
before insert or update on public.check_ins
for each row execute function public.tg_check_ins_validate();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'check_ins'
  ) then
    alter publication supabase_realtime add table public.check_ins;
  end if;
exception
  when undefined_object then null;
  when duplicate_object then null;
end
$$;

create or replace function public.checkin_create(
  _cpf text,
  _cliente_nome text,
  _tatuador text,
  _risk_flag boolean default false,
  _risk_reasons text[] default '{}',
  _has_ficha boolean default false,
  _has_assinatura boolean default false,
  _observacoes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  d text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  new_id uuid;
  next_pos integer;
  today date := (now() at time zone 'America/Fortaleza')::date;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;
  if d !~ '^[0-9]{11}$' then
    raise exception 'CPF invalido';
  end if;

  if exists (
    select 1
    from public.check_ins
    where cpf = d
      and queue_day = today
      and status in ('waiting', 'called', 'in_service')
  ) then
    raise exception 'Cliente ja possui check-in aberto hoje' using errcode = '23505';
  end if;

  select coalesce(max(queue_position), 0) + 1
    into next_pos
  from public.check_ins
  where queue_day = today;

  insert into public.check_ins(
    cpf,
    cliente_nome,
    tatuador,
    status,
    arrival_at,
    queue_day,
    queue_position,
    risk_flag,
    risk_reasons,
    has_ficha,
    has_assinatura,
    observacoes,
    created_by,
    updated_by
  )
  values (
    d,
    btrim(_cliente_nome),
    nullif(btrim(coalesce(_tatuador, '')), ''),
    'waiting',
    now(),
    today,
    next_pos,
    coalesce(_risk_flag, false),
    coalesce(_risk_reasons, '{}'),
    coalesce(_has_ficha, false),
    coalesce(_has_assinatura, false),
    nullif(btrim(coalesce(_observacoes, '')), ''),
    auth.uid(),
    auth.uid()
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.checkin_call(_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;
  update public.check_ins
     set status = 'called',
         called_at = now(),
         updated_by = auth.uid()
   where id = _id;
  if not found then
    raise exception 'Check-in nao encontrado';
  end if;
end;
$$;

create or replace function public.checkin_start(_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;
  update public.check_ins
     set status = 'in_service',
         started_at = now(),
         called_at = coalesce(called_at, now()),
         updated_by = auth.uid()
   where id = _id;
  if not found then
    raise exception 'Check-in nao encontrado';
  end if;
end;
$$;

create or replace function public.checkin_complete(_id uuid, _observacao text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;
  update public.check_ins
     set status = 'completed',
         completed_at = now(),
         updated_by = auth.uid(),
         observacoes = coalesce(nullif(btrim(coalesce(_observacao, '')), ''), observacoes)
   where id = _id;
  if not found then
    raise exception 'Check-in nao encontrado';
  end if;
end;
$$;

create or replace function public.checkin_cancel(_id uuid, _motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;
  if _motivo is null or length(btrim(_motivo)) < 3 then
    raise exception 'Motivo obrigatorio';
  end if;
  update public.check_ins
     set status = 'cancelled',
         cancelled_at = now(),
         cancel_reason = btrim(_motivo),
         updated_by = auth.uid()
   where id = _id;
  if not found then
    raise exception 'Check-in nao encontrado';
  end if;
end;
$$;

create or replace function public.checkin_no_show(_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;
  update public.check_ins
     set status = 'no_show',
         no_show_at = now(),
         updated_by = auth.uid()
   where id = _id;
  if not found then
    raise exception 'Check-in nao encontrado';
  end if;
end;
$$;

create or replace function public.checkin_add_note(_id uuid, _texto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;
  if _texto is null or length(btrim(_texto)) = 0 then
    raise exception 'Texto obrigatorio';
  end if;

  update public.check_ins
     set observacoes = btrim(_texto),
         updated_by = auth.uid()
   where id = _id;

  insert into public.check_in_events(check_in_id, kind, actor_id, motivo)
  values (_id, 'note_added', auth.uid(), btrim(_texto));
end;
$$;

create or replace function public.checkin_reorder(_id uuid, _new_position integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d date;
  old_pos integer;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;
  if _new_position < 1 then
    raise exception 'Posicao invalida';
  end if;

  select queue_day, queue_position
    into d, old_pos
  from public.check_ins
  where id = _id;

  if d is null then
    raise exception 'Check-in nao encontrado';
  end if;
  if old_pos = _new_position then
    return;
  end if;

  if _new_position < old_pos then
    update public.check_ins
       set queue_position = queue_position + 1
     where queue_day = d
       and queue_position >= _new_position
       and queue_position < old_pos
       and id <> _id;
  else
    update public.check_ins
       set queue_position = queue_position - 1
     where queue_day = d
       and queue_position <= _new_position
       and queue_position > old_pos
       and id <> _id;
  end if;

  update public.check_ins
     set queue_position = _new_position,
         updated_by = auth.uid()
   where id = _id;

  insert into public.check_in_events(check_in_id, kind, actor_id, detalhes)
  values (_id, 'reordered', auth.uid(), jsonb_build_object('from', old_pos, 'to', _new_position));
end;
$$;

revoke execute on function public.checkin_create(text, text, text, boolean, text[], boolean, boolean, text) from anon, public;
revoke execute on function public.checkin_call(uuid) from anon, public;
revoke execute on function public.checkin_start(uuid) from anon, public;
revoke execute on function public.checkin_complete(uuid, text) from anon, public;
revoke execute on function public.checkin_cancel(uuid, text) from anon, public;
revoke execute on function public.checkin_no_show(uuid) from anon, public;
revoke execute on function public.checkin_add_note(uuid, text) from anon, public;
revoke execute on function public.checkin_reorder(uuid, integer) from anon, public;

grant execute on function public.checkin_create(text, text, text, boolean, text[], boolean, boolean, text) to authenticated;
grant execute on function public.checkin_call(uuid) to authenticated;
grant execute on function public.checkin_start(uuid) to authenticated;
grant execute on function public.checkin_complete(uuid, text) to authenticated;
grant execute on function public.checkin_cancel(uuid, text) to authenticated;
grant execute on function public.checkin_no_show(uuid) to authenticated;
grant execute on function public.checkin_add_note(uuid, text) to authenticated;
grant execute on function public.checkin_reorder(uuid, integer) to authenticated;

create table if not exists public.risk_reviews (
  alert_id text primary key,
  cpf text not null,
  form_id text not null,
  form_version integer not null default 1,
  level text not null check (level in ('attention', 'high')),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'under_review', 'reviewed', 'requires_attention', 'released', 'archived')),
  decision text,
  observacao text,
  previous_decision text,
  previous_observacao text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_risk_reviews_status on public.risk_reviews(status);
create index if not exists idx_risk_reviews_cpf on public.risk_reviews(cpf);
grant select, insert, update on public.risk_reviews to authenticated;
grant all on public.risk_reviews to service_role;
alter table public.risk_reviews enable row level security;

drop policy if exists "admins read risk_reviews" on public.risk_reviews;
create policy "admins read risk_reviews"
on public.risk_reviews
for select
to authenticated
using (public.is_admin());

drop policy if exists "admins upsert risk_reviews" on public.risk_reviews;
create policy "admins upsert risk_reviews"
on public.risk_reviews
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "admins update risk_reviews" on public.risk_reviews;
create policy "admins update risk_reviews"
on public.risk_reviews
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.tg_risk_reviews_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_risk_reviews_touch on public.risk_reviews;
create trigger trg_risk_reviews_touch
before update on public.risk_reviews
for each row execute function public.tg_risk_reviews_touch();

create table if not exists public.risk_review_events (
  id uuid primary key default gen_random_uuid(),
  alert_id text not null,
  kind text not null check (
    kind in (
      'created',
      'review_started',
      'decision_recorded',
      'decision_changed',
      'note_added',
      'archived',
      'reopened',
      'new_version'
    )
  ),
  from_status text,
  to_status text,
  from_decision text,
  to_decision text,
  actor_id uuid,
  motivo text,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_risk_review_events_alert on public.risk_review_events(alert_id, created_at desc);
grant select, insert on public.risk_review_events to authenticated;
grant all on public.risk_review_events to service_role;
alter table public.risk_review_events enable row level security;

drop policy if exists "admins read risk_events" on public.risk_review_events;
create policy "admins read risk_events"
on public.risk_review_events
for select
to authenticated
using (public.is_admin());

drop policy if exists "admins insert risk_events" on public.risk_review_events;
create policy "admins insert risk_events"
on public.risk_review_events
for insert
to authenticated
with check (public.is_admin());

create or replace function public.risk_review_set(
  _alert_id text,
  _cpf text,
  _form_id text,
  _form_version integer,
  _level text,
  _new_status text,
  _decision text,
  _observacao text,
  _motivo_alt text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  existing public.risk_reviews%rowtype;
  is_change boolean := false;
  from_status text;
  from_decision text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;
  if _alert_id is null or length(_alert_id) = 0 then
    raise exception 'alert_id obrigatorio';
  end if;
  if d_cpf !~ '^[0-9]{11}$' then
    raise exception 'CPF invalido';
  end if;
  if _level not in ('attention', 'high') then
    raise exception 'Nivel invalido';
  end if;
  if _new_status not in ('pending_review', 'under_review', 'reviewed', 'requires_attention', 'released', 'archived') then
    raise exception 'Status invalido';
  end if;

  select *
    into existing
  from public.risk_reviews
  where alert_id = _alert_id
  for update;

  if not found then
    insert into public.risk_reviews(
      alert_id,
      cpf,
      form_id,
      form_version,
      level,
      status,
      decision,
      observacao,
      reviewed_by,
      reviewed_at
    )
    values (
      _alert_id,
      d_cpf,
      _form_id,
      coalesce(_form_version, 1),
      _level,
      _new_status,
      nullif(btrim(coalesce(_decision, '')), ''),
      nullif(btrim(coalesce(_observacao, '')), ''),
      case when _new_status = 'pending_review' then null else auth.uid() end,
      case when _new_status = 'pending_review' then null else now() end
    );

    insert into public.risk_review_events(alert_id, kind, to_status, to_decision, actor_id)
    values (_alert_id, 'created', _new_status, nullif(btrim(coalesce(_decision, '')), ''), auth.uid());
    return;
  end if;

  from_status := existing.status;
  from_decision := existing.decision;
  is_change := (existing.decision is distinct from nullif(btrim(coalesce(_decision, '')), ''))
            or (existing.status is distinct from _new_status);

  if existing.decision is not null
     and is_change
     and nullif(btrim(coalesce(_decision, '')), '') is distinct from existing.decision then
    if _motivo_alt is null or length(btrim(_motivo_alt)) < 3 then
      raise exception 'Motivo obrigatorio para alterar decisao registrada';
    end if;
  end if;

  update public.risk_reviews
     set level = _level,
         status = _new_status,
         previous_decision = case when is_change then existing.decision else previous_decision end,
         previous_observacao = case when is_change then existing.observacao else previous_observacao end,
         decision = nullif(btrim(coalesce(_decision, '')), ''),
         observacao = nullif(btrim(coalesce(_observacao, '')), ''),
         reviewed_by = case when _new_status = 'pending_review' then reviewed_by else auth.uid() end,
         reviewed_at = case when _new_status = 'pending_review' then reviewed_at else now() end,
         form_version = coalesce(_form_version, form_version)
   where alert_id = _alert_id;

  if is_change then
    insert into public.risk_review_events(
      alert_id,
      kind,
      from_status,
      to_status,
      from_decision,
      to_decision,
      actor_id,
      motivo
    )
    values (
      _alert_id,
      case when existing.decision is null then 'decision_recorded' else 'decision_changed' end,
      from_status,
      _new_status,
      from_decision,
      nullif(btrim(coalesce(_decision, '')), ''),
      auth.uid(),
      nullif(btrim(coalesce(_motivo_alt, '')), '')
    );
  end if;
end;
$$;

create or replace function public.risk_review_add_note(_alert_id text, _texto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;
  if _texto is null or length(btrim(_texto)) = 0 then
    raise exception 'Texto obrigatorio';
  end if;
  if not exists (select 1 from public.risk_reviews where alert_id = _alert_id) then
    raise exception 'Alerta nao encontrado';
  end if;

  insert into public.risk_review_events(alert_id, kind, actor_id, motivo)
  values (_alert_id, 'note_added', auth.uid(), btrim(_texto));
end;
$$;

create or replace function public.risk_review_archive(_alert_id text, _motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;
  if _motivo is null or length(btrim(_motivo)) < 3 then
    raise exception 'Motivo obrigatorio';
  end if;

  update public.risk_reviews
     set status = 'archived',
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where alert_id = _alert_id;

  if not found then
    raise exception 'Alerta nao encontrado';
  end if;

  insert into public.risk_review_events(alert_id, kind, to_status, actor_id, motivo)
  values (_alert_id, 'archived', 'archived', auth.uid(), btrim(_motivo));
end;
$$;

grant execute on function public.risk_review_set(text, text, text, integer, text, text, text, text, text) to authenticated;
grant execute on function public.risk_review_add_note(text, text) to authenticated;
grant execute on function public.risk_review_archive(text, text) to authenticated;

commit;
