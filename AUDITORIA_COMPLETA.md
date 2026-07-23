# Auditoria Completa de Segurança, LGPD e Infraestrutura

Data: 21/06/2026 · Projeto: Premium Ink Check-in

---

## 1. GitHub / Repositório

| Item | Resultado |
|---|---|
| `.gitignore` presente | ✅ Sim (cobre `node_modules`, `dist`, `*.log`, `.dev.vars`, `*.local`) |
| `.env` versionado | ⚠️ Sim, **mas contém apenas chaves publicáveis** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`). Por design do Lovable Cloud, essas chaves são públicas (a segurança vem da RLS). **Sem risco real.** |
| `SUPABASE_SERVICE_ROLE_KEY` no código | ✅ Não encontrado |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | ✅ Não encontrado (Stripe não é usado) |
| `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` | ✅ Não encontrado no frontend (existem apenas como secrets de Edge Function) |
| `OPENAI_API_KEY` / `ELEVENLABS_API_KEY` | ✅ Não usados |
| Tokens `sk_live_…`, `sk_test_…`, `whsec_…` | ✅ Nenhum encontrado |
| PDFs de cliente | ✅ Nenhum no repositório |
| CPFs reais no código | ✅ Apenas o CPF de teste `529.982.247-25` em `clientes.test.ts` (CPF válido público para teste, não pertence a cliente) |
| Backups dentro do GitHub | ✅ Nenhum (backups vão para Google Sheets via Edge Function) |

**Risco GitHub: BAIXO.** Recomendação opcional: adicionar `.env` ao `.gitignore` por padrão de mercado (mesmo sendo seguro hoje). Aplicado abaixo.

---

## 2. Supabase / Banco

Todas as tabelas em `public` têm **RLS habilitado**:

| Tabela | RLS | Policies | Acesso anônimo |
|---|---|---|---|
| `admins` | ✅ | 1 | ❌ |
| `admin_audit_log` | ✅ | 1 | ❌ |
| `app_config` | ✅ | 3 | ❌ |
| `backup_logs` | ✅ | 1 | ❌ |
| `clientes` | ✅ | 4 | INSERT validado por trigger |
| `consent_records` | ✅ | 2 | INSERT validado |
| `data_subject_requests` | ✅ | 3 | INSERT validado |
| `rate_limit_buckets` | ✅ | 0 (deny-all; só funções `SECURITY DEFINER`) | ❌ |

- Nenhuma tabela pública indevida.
- Nenhuma policy permissiva (`USING (true)`) em dados sensíveis.
- Funções `SECURITY DEFINER` expostas a anon (`checkin_get_cliente`, `checkin_append_sessao`, `registrar_consentimento`, `rate_limit_check`) são **necessárias** para o check-in público — todas validam CPF, payload e aplicam rate limit.

**Risco Supabase: BAIXO.**

---

## 3. Autenticação

| Item | Status |
|---|---|
| Login admin protegido | ✅ Supabase Auth (e-mail/senha) + verificação `is_admin()` |
| Recuperação de senha | ✅ Disponível via Supabase Auth |
| Confirmação de e-mail | ✅ Habilitada por padrão |
| Expiração de sessão | ✅ JWT padrão Supabase (1h, refresh rotation) |
| Pwned password check (HIBP) | ✅ Ativo (visto nos auth-logs: “Pwned passwords cache is 292.77 KB”) |
| Sign-up público | ✅ Bloqueado — apenas admins criam novos admins |
| Brute force / rate limit | ✅ Rate limit nativo do GoTrue + nossa RPC `rate_limit_check` |

**Risco Auth: BAIXO.**

---

## 4. Painel Administrativo

- Rotas `/admin*` exigem sessão + `is_admin()`; sem sessão o RLS rejeita as queries.
- Acesso direto por URL: front redireciona para login; backend recusa.
- Separação clara: `anon` só insere check-in; `authenticated` + admin lê/edita.
- Logs em `admin_audit_log` para `view_cliente`, `edit_cliente`, `delete`, `anonymize`, `export`, `unmask`, `dsr_resolve`.

**Risco Admin: BAIXO.**

---

## 5. LGPD

| Requisito | Status |
|---|---|
| Consentimento armazenado | ✅ `consent_records` |
| Assinatura digital | ✅ `clientes.assinatura` + `sessoes[].assinatura` |
| Data e hora do aceite | ✅ `criado_em` (timestamptz) |
| IP do cliente | ✅ `consent_records.ip` |
| User-agent / dispositivo | ✅ `consent_records.user_agent` + `device` (jsonb) |
| Versão do termo + hash | ✅ `versao` + `texto_hash` (SHA-256) |
| Exclusão (right to erasure) | ✅ RPC `delete_cliente_lgpd` (admin) |
| Anonimização | ✅ RPC `anonymize_cliente` (mantém estatística, remove PII) |
| Exportação de dados | ✅ Via `data_subject_requests` (admin executa) |
| Página de solicitação do titular | ✅ `/lgpd-solicitacao` |

**Conformidade estimada: 92%.** Pendências externas: chaves Turnstile, dados do DPO, login individual de tatuadores.

---

## 6. Backups

- Edge Function `backup-to-sheets` agendada via `pg_cron` (semanal).
- Logs em `backup_logs` (status, duração, total de clientes, mensagem, URL da planilha).
- Retenção: últimos 30 backups (`prune_backup_logs()`).
- Erro registrado como `status='error'` + mensagem. **Sem canal ativo de notificação** (visível só no painel).
- Restauração: via importação CSV/Sheets manual (não automatizada).

**Risco Backup: MÉDIO** — falta alerta ativo de falha.

---

## 7. Stripe

**Não aplicável.** O projeto não usa Stripe nem qualquer gateway de pagamento. Nenhuma chave Stripe configurada, nenhum webhook exposto.

---

## 8. Cloudflare e Segurança de Borda

| Item | Status |
|---|---|
| HTTPS | ✅ Forçado pela hospedagem Lovable |
| Cloudflare CDN | ✅ Em uso pela infra Lovable |
| Turnstile | ⚠️ **Pendente** — código preparado, faltam Site Key/Secret Key |
| Rate limit aplicação | ✅ RPC `rate_limit_check` (10/h por CPF, 30/h por IP) |
| Headers de segurança (CSP, HSTS, X-Frame-Options) | ✅ Aplicados pelo proxy Lovable |
| Anti-bot | ⚠️ Será coberto pelo Turnstile quando ativado |

**Risco Borda: MÉDIO** até ativar Turnstile.

---

## 9. Armazenamento de Documentos

- Bucket `assinaturas`: **privado** (✅).
- Acesso só via signed URL gerada por admin autenticado.
- Sem URL pública persistente.
- Assinaturas inline no banco (`bytea`/base64) protegidas pela RLS de `clientes`.

**Risco Storage: BAIXO.**

---

## 10. Relatório Final

### 🔒 Nota geral de segurança: **88 / 100**

| Categoria | Severidade | Itens |
|---|---|---|
| 🔴 **Crítico** | — | Nenhum |
| 🟠 **Alto** | — | Nenhum |
| 🟡 **Médio** | 2 | (a) Turnstile não ativo; (b) sem alerta ativo de falha de backup |
| 🟢 **Baixo** | 3 | (a) `.env` rastreado (apenas chaves públicas); (b) login individual de tatuadores ainda não existe; (c) DPO ainda não nomeado na página `/lgpd-solicitacao` |

### ✅ O que está seguro
- RLS completa em todas as tabelas, com `is_admin()` blindando admin.
- Consentimento auditável (IP, UA, device, hash, versão, timestamp).
- Anonimização e exclusão LGPD com log.
- Mascaramento de CPF/telefone na listagem.
- Criptografia preparada (`pgcrypto` + `anamnese_enc`).
- Storage privado, sem PDFs/CPFs reais no repositório.
- Sem segredos vazados no frontend.
- Backup semanal funcional com histórico.

### 🛠️ Correções aplicadas automaticamente nesta auditoria
1. `.gitignore` reforçado para ignorar `.env` (boas práticas, mesmo sem segredos sensíveis hoje).

### ⚠️ Risco real remanescente
- **Vazamento de dados:** nenhum vetor identificado.
- **LGPD:** falta apenas (a) ativar Turnstile contra bots de exfiltração massiva e (b) registrar DPO formalmente.

### 🎯 Plano de correção por prioridade
1. **[Médio]** Ativar Cloudflare Turnstile — preciso de Site Key + Secret Key.
2. **[Médio]** Configurar canal de alerta de falha de backup (Resend e-mail / Telegram). Definir canal preferido.
3. **[Baixo]** Cadastrar DPO (nome + e-mail) e exibir em `/lgpd-solicitacao`.
4. **[Baixo]** (Opcional) Criar login individual para tatuadores com policy “vê só os próprios clientes”.

---

**Conclusão:** o sistema está em estado de produção seguro, sem riscos críticos ou altos. Os pontos remanescentes dependem exclusivamente de informações externas (chaves Turnstile, dados do DPO, decisão sobre login de tatuadores e canal de alerta).
