-- =============================================================================
-- DIAGNOSTICO — rode isto PRIMEIRO no SQL Editor do Supabase (projeto gsoevvflqrfqyqpewzwv)
-- Nao altera nada. So le dados. Copie o resultado antes de aplicar qualquer fix.
-- =============================================================================

-- 1) O usuario existe em auth.users? Esta confirmado? Esta banido?
select
  id,
  email,
  email_confirmed_at,
  banned_until,
  deleted_at,
  created_at,
  last_sign_in_at
from auth.users
where lower(email) = lower('85tattoo@gmail.com');

-- 2) Existe mais de uma identidade/registro parecido (espaco, maiusculas, dominio errado)?
select id, email, created_at
from auth.users
where email ilike '%85tattoo%';

-- 3) O UUID acima tem role 'admin' em public.user_roles?
--    (troque <UUID_DO_PASSO_1> pelo id retornado no passo 1)
select user_id, role
from public.user_roles
where user_id = '<UUID_DO_PASSO_1>'::uuid;

-- 4) has_role() funciona para esse UUID? (deve retornar true depois do fix)
select public.has_role('<UUID_DO_PASSO_1>'::uuid, 'admin'::public.app_role) as has_admin_role;

-- 5) Existe algum registro no user_roles para esse email com um UUID DIFERENTE
--    (perfil orfao, apontando pra outro usuario)?
select ur.user_id, ur.role, u.email
from public.user_roles ur
join auth.users u on u.id = ur.user_id
where ur.role = 'admin'::public.app_role;

-- 6) A tabela legada public.admins (versao antiga do sistema) tem alguma entrada
--    que deveria estar em user_roles e nao esta?
select a.user_id, u.email, a.criado_em
from public.admins a
join auth.users u on u.id = a.user_id;
