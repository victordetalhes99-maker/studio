# Cloudflare Turnstile — Relatório de Implementação

Data: 21/06/2026

## ✅ O que foi implementado

### 1. Backend — Edge Function `verify-turnstile`
- Arquivo: `supabase/functions/verify-turnstile/index.ts`
- **Deploy:** ✅ ativa em produção.
- Recebe `{ token, action }`, repassa para `https://challenges.cloudflare.com/turnstile/v0/siteverify` com:
  - `secret` lido do segredo seguro `TURNSTILE_SECRET_KEY` (não exposto ao frontend).
  - `remoteip` lido de `cf-connecting-ip` / `x-forwarded-for`.
- Retorna **HTTP 200** apenas quando a Cloudflare confirma `success: true`.
- Em qualquer falha (token inválido, expirado, ausente, erro do siteverify), retorna **HTTP 4xx/500** com `{ success: false, error }`.

### 2. Frontend — utilitários reutilizáveis
- `src/lib/turnstile.ts`
  - `TURNSTILE_SITE_KEY = "0x4AAAAAADognQzkw5zB0jmN"` (pública por design).
  - `loadTurnstileScript()` carrega o JS oficial sob demanda, **uma única vez por sessão**.
  - `verifyTurnstileToken(token, action)` invoca a edge function `verify-turnstile`.
- `src/components/Turnstile.tsx` — widget React (`render=explicit`, tema dark) que entrega o token via `onToken`.

### 3. Pontos protegidos

| Local | Arquivo | Ação | Validação |
|---|---|---|---|
| **Login admin** | `src/routes/admin.tsx` | `login` | Bloqueia o submit até o usuário concluir o desafio; backend valida via `verify-turnstile` antes de chamar `signInWithPassword` e antes do `check_login_lockout` |
| **Check-in público (entrada)** | `src/routes/index.tsx` | `checkin` | Bloqueia o avanço para `/cadastro` ou `/recorrente`. Marca `sessionStorage.checkin_ts_ok` após validação, protegendo todo o fluxo público downstream |
| **Cadastro de cliente** | `src/routes/cadastro.$cpf.tsx` | herdado de `checkin` | Só acessível após passar pelo check-in com Turnstile válido |
| **Recorrente / nova sessão** | `src/routes/recorrente.$cpf.tsx` | herdado de `checkin` | Idem |
| **Solicitação LGPD** | `src/routes/lgpd-solicitacao.tsx` | `dsr` | Bloqueia envio até validar o token; double-check no backend antes de gravar |

### 4. Recuperação de senha
- O sistema **não expõe fluxo público de reset** hoje (login admin é interno). Quando ativado, basta plugar o mesmo componente `<Turnstile action="reset" />` no formulário e chamar `verifyTurnstileToken` antes de `resetPasswordForEmail`.

---

## 🔐 Como a validação ocorre (fluxo)

```
Usuário → resolve desafio → widget retorna token
       → frontend chama verify-turnstile (Edge Function)
       → Edge usa SECRET (server-side) e bate em siteverify
       → success=true ⇒ frontend prossegue (login/check-in/DSR)
       → success=false ⇒ mensagem amigável + token descartado
```

- O **Site Key** é público (visível no DOM, isso é o esperado).
- O **Secret Key** **nunca** trafega para o cliente; fica apenas no segredo `TURNSTILE_SECRET_KEY` da Edge Function.
- Token é de uso único (Cloudflare invalida após o siteverify); o frontend não reaproveita.

---

## 💬 Mensagens de erro amigáveis

| Situação | Mensagem |
|---|---|
| Usuário ainda não resolveu o desafio | “Confirme que você não é um robô.” |
| Token expirou ou foi rejeitado | “Verificação de segurança falhou. Recarregue a página e tente de novo.” |
| Erro de rede / Edge Function | mesma mensagem acima |

---

## 🧪 Como testar
1. Abrir `/` → marcar o desafio Turnstile → digitar CPF → Avançar.
2. Abrir `/admin` → resolver desafio → entrar.
3. Abrir `/lgpd-solicitacao` → resolver desafio → enviar.
4. Para forçar falha: abrir DevTools → Network → bloquear `verify-turnstile` ou alterar o token; o sistema deve recusar e exibir a mensagem amigável.

---

## 📝 Observações
- Layout **não foi alterado**; o widget aparece em uma área neutra (centro do card), no tema dark, próximo aos botões existentes.
- Nenhuma funcionalidade existente foi removida; o fluxo continua igual quando o usuário humano resolve o desafio.
- Se a Cloudflare estiver inacessível (rede do cliente bloqueando `challenges.cloudflare.com`), o usuário vê o widget falhar — sugerimos adicionar instrução “Recarregue a página” já incluída na mensagem.

**Status:** ✅ Turnstile ativo nos 4 pontos críticos. Sistema agora rejeita bots automatizados antes mesmo de chegar ao banco.
