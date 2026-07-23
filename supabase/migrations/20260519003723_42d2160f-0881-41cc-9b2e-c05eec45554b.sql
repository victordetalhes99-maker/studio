
-- Tabela principal de clientes / check-ins
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf TEXT NOT NULL UNIQUE,
  nome_completo TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  tatuador TEXT,
  dados_cadastrais JSONB NOT NULL DEFAULT '{}'::jsonb,
  anamnese JSONB NOT NULL DEFAULT '{}'::jsonb,
  assinatura TEXT,
  sessoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'aguardando',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX clientes_criado_em_idx ON public.clientes (criado_em DESC);
CREATE INDEX clientes_tatuador_idx ON public.clientes (tatuador);

-- Atualiza atualizado_em automaticamente
CREATE OR REPLACE FUNCTION public.tg_set_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER clientes_set_atualizado_em
BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();

-- RLS
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa (anon) pode INSERIR um check-in
CREATE POLICY "Anyone can create checkin"
  ON public.clientes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Apenas usuários autenticados (admins) leem
CREATE POLICY "Authenticated can read clientes"
  ON public.clientes FOR SELECT
  TO authenticated
  USING (true);

-- Apenas usuários autenticados podem atualizar
CREATE POLICY "Authenticated can update clientes"
  ON public.clientes FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

-- Apenas usuários autenticados podem excluir
CREATE POLICY "Authenticated can delete clientes"
  ON public.clientes FOR DELETE
  TO authenticated
  USING (true);

-- Realtime
ALTER TABLE public.clientes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;
