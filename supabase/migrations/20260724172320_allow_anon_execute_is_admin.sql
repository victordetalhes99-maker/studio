-- =============================================================================
-- Correcao: "Nao foi possivel carregar os tatuadores" para clientes reais
--
-- CAUSA RAIZ:
--   A policy "Public read active tattoo_artists" e:
--     using (ativo = true or public.is_admin())
--   Isso e avaliado LINHA A LINHA. Para tatuadores com ativo = true, o
--   Postgres normalmente nao precisa chamar is_admin() (curto-circuito do
--   OR). Mas para qualquer tatuador com ativo = false (inativo/pausado), o
--   Postgres PRECISA avaliar is_admin() para decidir se aquela linha e
--   visivel — e como a funcao is_admin() teve seu EXECUTE revogado de
--   "anon" (por design, em outra migration), isso gera um erro de
--   permissao que aborta a consulta INTEIRA, nao so aquela linha.
--
--   Resultado pratico: a lista de tatuadores so carrega para clientes
--   anonimos enquanto TODOS os tatuadores estiverem ativos. No instante em
--   que qualquer um for marcado como inativo/pausado, o cadastro publico
--   inteiro passa a falhar ao carregar tatuadores — de forma consistente,
--   nao intermitente, e sem relacao com cache de navegador ou deploy.
--
-- CORRECAO:
--   is_admin() e has_role() sao funcoes seguras de chamar como anon: elas
--   apenas leem auth.uid() (que e null para anon) e retornam false, sem
--   nenhum efeito colateral nem exposicao de dado. Conceder EXECUTE para
--   anon nao abre nenhuma permissao nova de tabela — is_admin() continua
--   retornando false para quem nao esta autenticado como admin. Isso
--   resolve o problema atual e evita a mesma classe de bug em qualquer
--   policy futura que combine "publico" ou "admin" no mesmo using().
-- =============================================================================

grant execute on function public.has_role(uuid, public.app_role) to anon;
grant execute on function public.is_admin() to anon;

notify pgrst, 'reload schema';
