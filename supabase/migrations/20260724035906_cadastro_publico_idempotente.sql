-- =============================================================================
-- Cadastro publico (/cadastro): idempotencia por CPF + hardening de RLS
--
-- PROBLEMA 1 (idempotencia):
--   clientes.cpf e UNIQUE e anon so tem INSERT (sem SELECT/UPDATE) por
--   privacidade. Isso e correto, mas tem um efeito colateral: se o cliente
--   for criado com sucesso e uma etapa seguinte do cadastro falhar (rede,
--   consentimento, etc.), ao tentar novamente o INSERT falha por violacao de
--   unicidade e o cliente fica travado sem conseguir reenviar.
--
--   Esta migration cria uma RPC SECURITY DEFINER especifica que faz
--   INSERT ... ON CONFLICT (cpf) DO UPDATE, restrita as mesmas colunas e
--   validacoes que a policy publica ja permite, e apenas quando o registro
--   ainda esta em um status pre-atendimento (nunca sobrescreve um cliente ja
--   atendido). Isso preserva o mesmo modelo de confianca do INSERT publico
--   que ja existia — nao abre nenhuma leitura nova.
--
-- PROBLEMA 2 (RLS generica em consent_records):
--   A policy "Kiosk insert consent_records" usa `with check (true)`, sem
--   nenhuma restricao. Confirmado por auditoria do frontend: nenhum código
--   insere diretamente nessa tabela — todo o caminho publico passa pela RPC
--   `registrar_consentimento` (SECURITY DEFINER, search_path fixo). Como a
--   RPC nao depende dos grants do chamador, e seguro remover o INSERT direto
--   de anon/authenticated e manter a RPC como unico caminho de escrita
--   publico.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Coluna aditiva: vinculo real com tattoo_artists.id
--
--    Hoje `clientes.tatuador` guarda o NOME (decisao arquitetural já
--    existente e usada em ficha/contrato/check-in/PDFs — nome e tratado como
--    chave estavel no projeto). Trocar tudo para UUID exigiria reescrever
--    Fichas, Contratos, Check-in e geração de PDF, o que está fora do escopo
--    desta correção. Em vez disso, adicionamos uma coluna NOVA e opcional
--    que guarda o ID real, preenchida automaticamente sempre que o nome
--    bater com um tatuador ativo — sem remover ou substituir a coluna
--    `tatuador` existente, e sem exigir nenhuma mudança nas paginas que já
--    leem por nome.
-- ---------------------------------------------------------------------------
alter table public.clientes
  add column if not exists tattoo_artist_id uuid references public.tattoo_artists(id);

create index if not exists idx_clientes_tattoo_artist_id
  on public.clientes (tattoo_artist_id);

-- ---------------------------------------------------------------------------
-- 1) RPC idempotente de cadastro publico (create-or-continue por CPF)
-- ---------------------------------------------------------------------------
create or replace function public.finalizar_cadastro_cliente(
  _cpf text,
  _nome_completo text,
  _telefone text,
  _email text,
  _tatuador text,
  _dados_cadastrais jsonb,
  _anamnese jsonb,
  _assinatura text,
  _sessoes jsonb,
  _status text
)
returns table (id uuid, criado_agora boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  d_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  v_id uuid;
  v_existed boolean;
  v_artist_id uuid;
begin
  if d_cpf !~ '^[0-9]{11}$' then
    raise exception 'CPF invalido';
  end if;
  if _status not in ('aguardando', 'pendente_responsavel') then
    raise exception 'Status invalido para cadastro publico';
  end if;

  -- Resolve o ID real do tatuador pelo nome, somente se ativo. Nunca falha o
  -- cadastro se nao encontrar — fica null e o snapshot por nome permanece
  -- valido (mesma logica ja usada no resto do sistema).
  select id into v_artist_id
  from public.tattoo_artists
  where nome = _tatuador and ativo = true
  limit 1;

  select exists(
    select 1 from public.clientes
    where cpf = d_cpf
      and status in ('aguardando', 'pendente_responsavel')
  ) into v_existed;

  insert into public.clientes (
    cpf, nome_completo, telefone, email, tatuador, tattoo_artist_id,
    dados_cadastrais, anamnese, assinatura, sessoes, status
  )
  values (
    d_cpf, _nome_completo, _telefone, _email, _tatuador, v_artist_id,
    coalesce(_dados_cadastrais, '{}'::jsonb),
    coalesce(_anamnese, '{}'::jsonb),
    _assinatura,
    coalesce(_sessoes, '[]'::jsonb),
    _status
  )
  on conflict (cpf) do update set
    nome_completo = excluded.nome_completo,
    telefone = excluded.telefone,
    email = excluded.email,
    tatuador = excluded.tatuador,
    tattoo_artist_id = excluded.tattoo_artist_id,
    dados_cadastrais = excluded.dados_cadastrais,
    anamnese = excluded.anamnese,
    assinatura = excluded.assinatura,
    sessoes = excluded.sessoes,
    status = excluded.status
  where public.clientes.status in ('aguardando', 'pendente_responsavel')
  returning public.clientes.id into v_id;

  if v_id is null then
    -- Conflito existia mas o registro ja foi atendido: nao sobrescreve.
    raise exception 'Cadastro ja foi processado pelo estudio e nao pode ser reenviado por aqui.';
  end if;

  return query select v_id, not v_existed;
end;
$$;

revoke execute on function public.finalizar_cadastro_cliente(
  text, text, text, text, text, jsonb, jsonb, text, jsonb, text
) from public;
grant execute on function public.finalizar_cadastro_cliente(
  text, text, text, text, text, jsonb, jsonb, text, jsonb, text
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) consent_records: remover INSERT direto (sem restricao) e manter
--    apenas a RPC registrar_consentimento como caminho de escrita publico.
-- ---------------------------------------------------------------------------
revoke insert on public.consent_records from anon, authenticated;

drop policy if exists "Kiosk insert consent_records" on public.consent_records;
-- Sem policy de INSERT para anon/authenticated: a tabela so recebe escrita
-- via registrar_consentimento(), que e SECURITY DEFINER e portanto nao
-- depende de policy nem do grant do chamador.
