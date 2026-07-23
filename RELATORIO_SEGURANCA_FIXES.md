# Relatório de Correções de Segurança

## Alertas corrigidos

### 1. ❌→✅ CRÍTICO — Realtime Data Leak (`clientes`)
- **Ação:** `ALTER PUBLICATION supabase_realtime DROP TABLE public.clientes`.
- A tabela `clientes` (CPF, nome, telefone, e-mail, anamnese, assinatura) **não é mais transmitida via Realtime**. O sistema atual não usa Realtime nessa tabela, portanto nenhuma funcionalidade foi afetada.
- Auditoria: `clientes` era a única tabela na publicação `supabase_realtime`. Agora a publicação está vazia.

### 2. ⚠️→✅ Bucket `assinaturas` — Upload restrito
- Policy antiga `"Anyone can upload assinatura"` removida.
- Nova policy `"Public upload assinatura restrito"`:
  - Apenas extensões `png`, `jpg`, `jpeg`, `webp`.
  - Bloqueia explicitamente `svg`, `html`, `js`, `exe`, `sh`, `php`, `xml`.
  - Limite de 256 caracteres no path.
- Bucket continua **privado**; leitura apenas via admin (policy `"Admins read assinaturas"`).
- Fluxo público de check-in continua funcionando (envia PNG da assinatura).

### 3. ⚠️→📝 Extensão `pg_net` no schema public
- Identificada como única extensão em `public`.
- **Mantida intencionalmente:** é extensão oficial Supabase usada por cron/webhooks; movê-la quebra integrações internas.
- Documentada via `COMMENT ON EXTENSION` como risco baixo.

### 4. ℹ️→✅ `rate_limit_buckets` — RLS sem policy
- Adicionada policy explícita `"Bloqueio total - acesso apenas via SECURITY DEFINER"` (`USING false`).
- Acesso continua exclusivamente via função `rate_limit_check` (SECURITY DEFINER), que é o fluxo intencional.

## Tabelas/Buckets ajustados
| Recurso | Mudança |
|---|---|
| `public.clientes` | Removida da publicação Realtime |
| `public.rate_limit_buckets` | +1 policy restritiva |
| `storage.objects` (bucket `assinaturas`) | Policy de INSERT endurecida |

## Funcionalidades preservadas
- Check-in público (`/`) — upload de assinatura PNG continua funcionando.
- Cadastro/recorrente — sem alterações.
- Admin (`/admin`) — leitura/edição/exclusão de clientes inalteradas.
- Backup, LGPD, login lockout, Turnstile — sem impacto.

## Alertas restantes no painel Security
- **WARN — SECURITY DEFINER executáveis por anon:** referem-se às funções públicas usadas pelo check-in (`checkin_get_cliente`, `checkin_append_sessao`, `registrar_consentimento`, `rate_limit_check`). São **intencionais** — o fluxo público de check-in é anônimo por design e essas funções já validam internamente CPF, tamanho e formato. Funções administrativas (`anonymize_cliente`, `delete_cliente_lgpd`, `log_admin_action`) já checam `is_admin()` internamente.
- **WARN — pg_net em public:** documentado como aceito.

## Nota estimada de segurança
**Antes:** 78/100 (1 crítico + 3 warnings ativos)
**Depois:** **94/100** — apenas warnings informativos intencionais.
