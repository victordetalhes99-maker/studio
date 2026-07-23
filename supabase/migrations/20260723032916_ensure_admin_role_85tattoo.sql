-- =============================================================================
-- Garante a role 'admin' para 85tattoo@gmail.com em public.user_roles
--
-- Por que isto e necessario:
--   O login em /admin-login so libera acesso quando
--   public.has_role(auth.uid(), 'admin') = true, o que consulta
--   public.user_roles (user_id, role). Se o usuario existe em auth.users,
--   autentica corretamente, mas nao tem uma linha correspondente em
--   public.user_roles com role = 'admin', o painel bloqueia mesmo com a
--   senha certa — exatamente o sintoma relatado.
--
-- O que este script NAO faz:
--   - nao cria usuario novo;
--   - nao altera senha;
--   - nao mexe em auth.users;
--   - nao usa UUID fixo — resolve o UUID em tempo de execucao a partir do
--     e-mail, para nao depender de um valor copiado manualmente que pode
--     estar desatualizado ou errado.
--
-- Idempotente: pode ser executado quantas vezes for preciso, em qualquer
-- ambiente, sem duplicar linhas nem falhar se o usuario ja for admin.
-- =============================================================================

begin;

do $$
declare
  target_email text := '85tattoo@gmail.com';
  target_uid uuid;
begin
  select id
    into target_uid
  from auth.users
  where lower(email) = lower(target_email)
  order by created_at asc
  limit 1;

  if target_uid is null then
    raise exception
      'Nenhum usuario encontrado em auth.users com o e-mail %. '
      'Nao crie um usuario novo por aqui — confirme o cadastro no painel de Authentication do Supabase primeiro.',
      target_email;
  end if;

  insert into public.user_roles (user_id, role)
  select target_uid, 'admin'::public.app_role
  where not exists (
    select 1
    from public.user_roles
    where user_id = target_uid
      and role = 'admin'::public.app_role
  );

  raise notice 'Role admin garantida para % (uid=%)', target_email, target_uid;
end
$$;

commit;

-- Verificacao pos-fix (deve retornar true):
-- select public.has_role(id, 'admin'::public.app_role) as has_admin_role
-- from auth.users where lower(email) = lower('85tattoo@gmail.com');
