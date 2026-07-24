-- =============================================================================
-- Correcao: "column reference \"id\" is ambiguous" em finalizar_cadastro_cliente
--
-- Causa: a funcao declara `returns table (id uuid, criado_agora boolean)`,
-- o que cria uma variavel implicita chamada `id` no escopo PL/pgSQL. A
-- consulta `select id into v_artist_id from public.tattoo_artists ...`
-- ficava ambigua entre essa variavel e a coluna tattoo_artists.id.
--
-- Correcao: qualificar a coluna como tattoo_artists.id. Nenhuma outra
-- mudanca de comportamento.
-- =============================================================================

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
  select tattoo_artists.id into v_artist_id
  from public.tattoo_artists
  where tattoo_artists.nome = _tatuador and tattoo_artists.ativo = true
  limit 1;

  select exists(
    select 1 from public.clientes
    where public.clientes.cpf = d_cpf
      and public.clientes.status in ('aguardando', 'pendente_responsavel')
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

notify pgrst, 'reload schema';
