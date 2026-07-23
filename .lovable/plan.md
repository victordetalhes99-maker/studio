# Auditoria LGPD e segurança — Plano de implementação

A lista que você passou é grande e mexe em coisas bem diferentes (banco, edge functions, admin, integrações externas e PDF). Vou organizar em **fases** priorizadas pelo risco e pela dependência. Antes de começar a codar, preciso confirmar 3 coisas com você (no fim do plano).

---

## Estado atual (já existe)

- ✅ RLS habilitado em `clientes`, `admins`, `app_config` (políticas via `is_admin()`)
- ✅ Check-in público restrito por `WITH CHECK` (CPF, status, tamanho)
- ✅ Validação server-side em `tg_validate_cliente`
- ✅ LGPD textual + checkbox de aceite no fluxo
- ✅ Assinatura digital obrigatória (botão só libera com `assinatura`)
- ✅ Storage privado (`assinaturas`)
- ✅ Admin separado em tabela `admins` (não em coluna na profile)

## Lacunas identificadas

1. Nenhum registro de **IP / user-agent / timestamp** do aceite (LGPD art. 8º — prova de consentimento)
2. Sem **rate limit** no insert público de `clientes` nem no append de sessão
3. Sem **Turnstile / captcha** no kiosk
4. Anamnese (dados de saúde — sensíveis art. 11) salva em **JSONB plaintext**
5. Sem **logs de auditoria** de quem leu/editou fichas
6. CPF e telefone exibidos **sem máscara** no painel admin
7. Sem fluxo formal de **exclusão / anonimização** a pedido do titular
8. PDF da ficha assinada não é gerado/armazenado

---

## Fase 1 — Banco e auditoria (migration)

Uma migration única, sem mudar layout:

1. **Tabela `consent_records`** — append-only, registra cada aceite (LGPD + termo) com `cpf`, `tipo` (lgpd/termo/anamnese), `texto_hash`, `versao`, `ip`, `user_agent`, `device`, `criado_em`. RLS: insert público validado, leitura só admin.
2. **Tabela `admin_audit_log`** — registra `admin_id`, `acao` (view_cliente, edit_cliente, export, delete), `cliente_cpf`, `payload_diff jsonb`, `ip`, `user_agent`, `criado_em`. RLS: insert via SECURITY DEFINER, leitura só admin.
3. **Tabela `data_subject_requests`** — pedidos de exclusão/anonimização com `cpf`, `tipo` (delete/anonymize/export), `status`, `motivo`, `criado_em`, `resolvido_em`, `resolvido_por`. Insert público (anônimo via CPF + e-mail), gestão admin.
4. **Função `anonymize_cliente(_cpf)`** SECURITY DEFINER: zera nome, telefone, e-mail, endereço, anamnese; mantém só CPF hashado + estatística.
5. **Função `log_admin_action(...)`** SECURITY DEFINER chamada pelo client admin.
6. **Criptografia de saúde**: criar coluna `anamnese_enc bytea` usando `pgcrypto` (`pgp_sym_encrypt`) com chave de uma função `app.get_health_key()` lendo de `app_config` (admin-only). Migrar dados existentes. Manter `anamnese` jsonb legacy só com flags não-sensíveis (ou apagar após migração validada).
7. **Função `checkin_append_sessao_v2`** que recebe `_ip`, `_user_agent`, `_turnstile_token`, grava `consent_records`, opcionalmente criptografa anamnese. Antiga continua funcionando.

## Fase 2 — Edge functions

1. **`turnstile-verify`** — valida token Cloudflare Turnstile com a secret. Chamada antes de `saveCliente` / `addSessao`.
2. **`rate-limit`** — middleware simples por IP+CPF em uma tabela `rate_limit_buckets` (token bucket: 5 inserts/h por IP, 1 check-in / 5min por CPF).
3. **`gerar-ficha-pdf`** — gera PDF da ficha assinada (dados + termo + LGPD + assinatura PNG + hash de consentimento + IP/UA), salva em bucket `fichas-pdf` (privado), retorna URL assinada. Disparada após `saveCliente`.
4. **`solicitar-exclusao`** — recebe pedido público, valida CPF, grava em `data_subject_requests`, envia notificação ao admin.

## Fase 3 — Frontend (sem mexer em layout)

- Adicionar `<Turnstile />` invisível em `/cadastro/:cpf` e `/recorrente/:cpf`. Bloquear submit sem token.
- Capturar `navigator.userAgent`, idioma, timezone e enviar junto com o aceite.
- IP é capturado server-side na edge function (header `x-forwarded-for`).
- No painel admin (`/admin`):
  - Exibir CPF como `***.***.***-XX` e telefone como `(XX) ****-XXXX` por padrão; botão "Ver completo" registra acesso em `admin_audit_log`.
  - Nova aba **"Solicitações LGPD"** lista `data_subject_requests`, com botões "Anonimizar" / "Exportar" / "Negar".
  - Nova aba **"Auditoria"** lista `admin_audit_log` (últimos 90 dias).
  - Botão "Baixar ficha PDF" em cada cliente.
- Página pública `/lgpd/solicitacao` com form: CPF + e-mail + tipo de pedido + Turnstile. Sem login.

## Fase 4 — Documentação

Gerar `RELATORIO_LGPD.md` em `/mnt/documents/` cobrindo: bases legais usadas, dados tratados, retenção, medidas técnicas e administrativas, encarregado (DPO), direitos do titular, fluxos implementados, mapa de processamento. Entregue como artefato.

---

## Detalhes técnicos

- **Turnstile**: precisa do **site key** (público, no front) e **secret key** (em `add_secret`). Vou pedir as duas no momento certo.
- **Chave de criptografia da anamnese**: gerada uma vez, guardada em `vault`-like (`app_config` admin-only ou secret de edge function). Sem ela, anamnese antiga não é recuperável — guarde backup.
- **Mascaramento**: feito no front (admin já é autenticado), com unmask explícito logado. Não é "criptografia" — é controle de exposição visual.
- **PDF**: lib `pdf-lib` na edge function (Deno). Bucket privado `fichas-pdf` com URL assinada de 5 min.
- **Rate limit**: tabela `rate_limit_buckets(key, count, window_start)` com upsert atômico. Sem Redis.
- Nada do layout muda; todos os componentes ganham só novos props/efeitos.

## O que NÃO faço sem você confirmar

1. **Apagar a coluna `anamnese` jsonb antiga** depois da migração para `anamnese_enc`. Vou deixar as duas convivendo até você validar.
2. **Forçar Turnstile em produção** antes de você colar as chaves — senão o kiosk para. Em dev fica `bypass`.
3. **Definir prazo de retenção** dos PDFs e das fichas anonimizadas. Padrão sugerido: 5 anos (prazo prescricional civil).

---

## Perguntas antes de começar

1. **Cloudflare Turnstile**: você já tem conta Cloudflare. Quer que eu pré-configure o código e te peça as chaves depois, ou você cria o site (`85tattohouse.online`) no painel Turnstile primeiro?
2. **DPO / Encarregado**: nome + e-mail para constar no relatório e no rodapé da página de solicitação LGPD?
3. **Posso fazer tudo de uma vez** (Fases 1→4) ou prefere por fase, validando cada uma antes da próxima? Recomendo fase a fase, porque a Fase 1 mexe no banco e precisa do seu OK.

Me responde essas três e eu já começo pela Fase 1 (migration + auditoria).
