
-- Função do trigger com search_path fixo
CREATE OR REPLACE FUNCTION public.tg_set_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

-- Tabela de admins (papel separado, evita escalada de privilégio)
CREATE TABLE public.admins (
  user_id UUID PRIMARY KEY,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Função security definer: verifica se o usuário atual é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid());
$$;

-- Cada admin pode ver sua própria linha (e nada mais)
CREATE POLICY "Admin reads self" ON public.admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Substitui políticas amplas da tabela clientes
DROP POLICY IF EXISTS "Authenticated can read clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated can update clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated can delete clientes" ON public.clientes;

CREATE POLICY "Admins can read clientes" ON public.clientes
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can update clientes" ON public.clientes
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete clientes" ON public.clientes
  FOR DELETE TO authenticated
  USING (public.is_admin());
