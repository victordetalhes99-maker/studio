
-- 1. REALTIME: remove clientes from realtime publication (sensitive PII broadcast)
ALTER PUBLICATION supabase_realtime DROP TABLE public.clientes;

-- 2. STORAGE: harden assinaturas bucket INSERT policy
DROP POLICY IF EXISTS "Anyone can upload assinatura" ON storage.objects;

CREATE POLICY "Public upload assinatura restrito"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'assinaturas'
  AND lower(storage.extension(name)) IN ('png','jpg','jpeg','webp')
  AND octet_length(coalesce(name,'')) <= 256
  AND name !~* '\.(svg|html?|js|exe|sh|php|xml)$'
);

-- 3. RATE_LIMIT_BUCKETS: add explicit deny-all policy (acesso somente via SECURITY DEFINER)
CREATE POLICY "Bloqueio total - acesso apenas via SECURITY DEFINER"
ON public.rate_limit_buckets
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- 4. EXTENSION pg_net no schema public:
-- pg_net é usado por funcionalidades internas do Supabase (cron/webhooks).
-- Mover para schema 'extensions' pode quebrar integrações. Mantido em public
-- como risco BAIXO (extensão oficial Supabase, sem dados de usuário).
COMMENT ON EXTENSION pg_net IS 'Extensão oficial Supabase mantida em public por compatibilidade. Risco baixo.';
