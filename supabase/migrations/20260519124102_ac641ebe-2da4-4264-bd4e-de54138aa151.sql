
INSERT INTO storage.buckets (id, name, public)
VALUES ('assinaturas', 'assinaturas', false)
ON CONFLICT (id) DO NOTHING;

-- Qualquer um pode subir uma assinatura (check-in é anônimo)
CREATE POLICY "Anyone can upload assinatura"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'assinaturas');

-- Apenas admins podem ler
CREATE POLICY "Admins read assinaturas"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'assinaturas' AND public.is_admin());

-- Apenas admins podem atualizar/apagar
CREATE POLICY "Admins update assinaturas"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'assinaturas' AND public.is_admin());

CREATE POLICY "Admins delete assinaturas"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'assinaturas' AND public.is_admin());
