-- Fix manual para login administrativo no Supabase
-- Projeto: sistema-85
-- Data: 2026-07-18
--
-- Cenario resolvido:
-- 1. O usuario existe em auth.users e consegue autenticar por email/senha.
-- 2. O frontend so libera /admin quando public.has_role(uid, 'admin') = true.
-- 3. Varias policies antigas ainda chamam public.is_admin().
--
-- Este script:
-- - garante a role admin para o UID autenticavel correto
-- - redefine public.is_admin() para usar public.has_role()
-- - permite verificar o resultado imediatamente

begin;

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

grant execute on function public.is_admin() to authenticated;

insert into public.user_roles (user_id, role)
select
  'd65e5b1d-5224-478b-aeba-5dbdef96466d'::uuid,
  'admin'::public.app_role
where not exists (
  select 1
  from public.user_roles
  where user_id = 'd65e5b1d-5224-478b-aeba-5dbdef96466d'::uuid
    and role = 'admin'::public.app_role
);

commit;

-- Verificacoes
select id, email
from auth.users
where id = 'd65e5b1d-5224-478b-aeba-5dbdef96466d'::uuid;

select user_id, role
from public.user_roles
where user_id = 'd65e5b1d-5224-478b-aeba-5dbdef96466d'::uuid;

select public.has_role(
  'd65e5b1d-5224-478b-aeba-5dbdef96466d'::uuid,
  'admin'::public.app_role
) as has_admin_role;
