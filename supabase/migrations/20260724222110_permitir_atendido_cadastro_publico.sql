-- =============================================================================
-- Cadastro publico agora marca adultos como "atendido" imediatamente ao
-- concluir (decisao do estudio: uma vez que os dados+assinatura estao
-- completos, o cliente e considerado atendido, sem esperar acao manual do
-- admin). Menores continuam em "pendente_responsavel" ate a validacao do
-- responsavel, por exigencia legal — isso NAO muda.
--
-- Efeito colateral que esta migration corrige: a RPC so permitia reenvio
-- (retry apos falha de rede/consentimento) quando o cliente ainda estava
-- em 'aguardando' ou 'pendente_responsavel'. Como agora o cliente ja nasce
-- 'atendido', um reenvio legitimo minutos depois de uma falha parcial seria
-- bloqueado como se fosse tentativa de sobrescrever um cliente ja
-- atendido de verdade pelo estudio.
--
-- Correcao: a janela de protecao contra sobrescrita passa a valer por
-- tempo (1 hora a partir da criacao) em vez de depender só do status.
-- Isso cobre reenvios legitimos logo apos a criacao e continua protegendo
-- registros mais antigos — que ja podem ter sessoes, notas ou historico
-- real do estudio — contra serem sobrescritos por reenvio publico.
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
  if _status not in ('aguardando', 'pendente_responsavel', 'atendido') then
    raise exception 'Status invalido para cadastro publico';
  end if;

  select tattoo_artists.id into v_artist_id
  from public.tattoo_artists
  where tattoo_artists.nome = _tatuador and tattoo_artists.ativo = true
  limit 1;

  select exists(
    select 1 from public.clientes
    where cpf = d_cpf
      and (
        status in ('aguardando', 'pendente_responsavel')
        or criado_em > now() - interval '1 hour'
      )
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
     or public.clientes.criado_em > now() - interval '1 hour'
  returning public.clientes.id into v_id;

  if v_id is null then
    raise exception 'Cadastro ja foi processado pelo estudio e nao pode ser reenviado por aqui.';
  end if;

  return query select v_id, not v_existed;
end;
$$;

grant execute on function public.finalizar_cadastro_cliente(
  text, text, text, text, text, jsonb, jsonb, text, jsonb, text
) to anon, authenticated;

notify pgrst, 'reload schema';
