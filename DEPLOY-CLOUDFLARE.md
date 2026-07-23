# Deploy — Cloudflare Pages + GitHub

Guia para publicar o frontend do **85 TATTOO** no Cloudflare Pages a partir de
um repositório GitHub. O banco, autenticação, storage e Edge Functions
continuam no projeto Supabase existente — a Cloudflare hospeda apenas o SPA.

---

## 1. Stack confirmada

| Item                | Valor                                         |
| ------------------- | --------------------------------------------- |
| Framework           | Vite 7 + React 19 (SPA, `BrowserRouter`)      |
| Package manager     | Bun (lockfile `bun.lock`)                     |
| Backend             | Supabase (existente, permanece fora da CF)    |
| Saída de build      | `dist/`                                       |
| Runtime alvo        | Cloudflare **Pages** estático (não Worker/SSR)|

## 2. Enviar ao GitHub

1. Crie um repositório vazio no GitHub.
2. Envie o projeto para esse repositório pelo fluxo padrão do Git.
3. Confira que **não** foram commitados: `node_modules/`, `dist/`, `.env`,
   `.env.local`. O `.gitignore` já cobre esses casos.
4. Confirme que **foram** commitados: `public/_redirects`, `public/_headers`,
   `.env.example`, `bun.lock`, `vite.config.ts`, `supabase/`.

## 3. Conectar no Cloudflare Pages

Painel Cloudflare → **Workers & Pages** → **Create** → aba **Pages** →
**Connect to Git** → selecione o repositório.

> A opção "Create a Worker" também aparece no painel novo, mas esta aplicação
> é uma SPA estática — use **Pages**, não Worker.

### Configuração exata

| Campo                     | Valor                       |
| ------------------------- | --------------------------- |
| Production branch         | `main` (ou a sua)           |
| Framework preset          | **Vite**                    |
| Build command             | `bun install --frozen-lockfile && bun run build` |
| Build output directory    | `dist`                      |
| Root directory            | `/` (deixe vazio)           |

Se o preset Vite não preencher automaticamente o build command com `bun`,
force o comando acima. O Cloudflare Pages detecta o `bun.lock` e usa Bun.

### Node/Bun version (opcional, mas recomendado)

Em **Settings → Environment variables** adicione, **para Production e Preview**:

| Variável        | Valor       |
| --------------- | ----------- |
| `NODE_VERSION`  | `20`        |

## 4. Variáveis de ambiente no Cloudflare Pages

Adicione em **Settings → Environment variables** nos dois escopos (Production
**e** Preview). Sem elas o build falha explicitamente por design.

### Obrigatórias (públicas, embutidas no bundle)

| Nome                              | Origem                          |
| --------------------------------- | ------------------------------- |
| `VITE_SUPABASE_URL`               | Supabase → Project settings → API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY`   | Supabase → Project settings → publishable key (`sb_publishable_...`) |

### Opcionais

| Nome                        | Uso                                                         |
| --------------------------- | ----------------------------------------------------------- |
| `VITE_SUPABASE_PROJECT_ID`  | Exibido em telas administrativas.                           |
| `VITE_COMMIT_SHA`           | Rótulo de versão em `/admin/configuracoes/sistema`.         |

### **Nunca** coloque no Cloudflare Pages

Estes valores são privados e servidor-a-servidor — **ficam no Supabase**:

- `SUPABASE_SERVICE_ROLE_KEY`
- `TURNSTILE_SECRET_KEY`
- `GOOGLE_SHEETS_API_KEY`
- `LOVABLE_API_KEY`
- Qualquer senha, token, secret.

## 5. Supabase (permanece fora da Cloudflare)

- **Project URL / anon key**: use os do projeto Supabase atual.
- **Auth → URL configuration** (painel Supabase):
  - **Site URL**: `https://<seu-projeto>.pages.dev` inicialmente, depois o
    domínio personalizado quando ativo.
  - **Redirect URLs** (adicione todas):
    - `https://<seu-projeto>.pages.dev/**`
    - `https://<preview>.pages.dev/**` (se usar preview deploys)
    - `https://<dominio-final>/**`
    - `http://localhost:8080/**` (opcional, para dev local)
- **Edge Functions** existentes:
  - `verify-turnstile` — requer secret `TURNSTILE_SECRET_KEY`.
  - `backup-to-sheets` — requer `GOOGLE_SHEETS_API_KEY`, `LOVABLE_API_KEY`,
    `SUPABASE_SERVICE_ROLE_KEY`. Depende do gateway `connector-gateway.lovable.dev`
    e do Google Sheets connector — só funciona enquanto esse gateway estiver
    acessível. Sem ele, essa função específica precisará ser reescrita para
    chamar a API do Google Sheets diretamente (fora do escopo deste guia).
- Deploy das Edge Functions fora do Lovable, quando necessário:
  ```
  supabase functions deploy verify-turnstile --project-ref <PROJECT_REF>
  supabase functions deploy backup-to-sheets --project-ref <PROJECT_REF>
  supabase secrets set TURNSTILE_SECRET_KEY=... --project-ref <PROJECT_REF>
  ```
- CORS: as funções usam `Access-Control-Allow-Origin: *`. Se quiser restringir
  ao domínio Cloudflare, edite o `corsHeaders` de cada função.

## 6. SPA fallback e headers

Já presentes no repositório e copiados automaticamente para `dist/`:

- `public/_redirects` → `/* /index.html 200`
- `public/_headers` → cache imutável para `/assets/*`, `no-cache` para
  `index.html`, headers de segurança (`X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`).

Sem `_redirects`, qualquer refresh em `/admin/clientes` retorna 404.

## 7. Domínio personalizado

Pages → seu projeto → **Custom domains** → **Set up a custom domain**.
Depois de ativo, atualize no Supabase Auth as URLs de Site/Redirect com o
novo domínio.

## 8. Testes pós-deploy

Para cada rota — abrir pela navegação, acessar diretamente, e dar refresh:

```
/           /cadastro           /recorrente        /lgpd-solicitacao
/admin-login   /forgot-password   /reset-password
/admin      /admin/clientes     /admin/checkins    /admin/fichas
/admin/contratos   /admin/documentos   /admin/clientes-risco
/admin/relatorios  /admin/backup       /admin/configuracoes
```

Verifique também:

- Console limpo (sem erros de MIME/asset).
- `/assets/*.js` servido como `application/javascript`.
- `/assets/*.css` como `text/css`.
- Login em `/admin-login` funciona (usuário precisa existir em `public.admins`).
- Recuperação de senha envia e-mail e o link volta para
  `https://<seu-dominio>/reset-password`.
- Cadastro/anamnese/termo → assinatura preta gerada e enviada.
- Geração de PDF de contrato.

## 9. Rollback

Cloudflare Pages guarda todos os deploys. Em **Deployments**, escolha uma
versão anterior e clique em **Rollback**. O rollback é instantâneo e não
requer novo build.

## 10. Problemas comuns

| Sintoma                                             | Causa provável                                              |
| --------------------------------------------------- | ----------------------------------------------------------- |
| Tela branca em produção                             | Faltando `VITE_SUPABASE_URL` ou `VITE_SUPABASE_PUBLISHABLE_KEY` no ambiente Production do Pages. |
| 404 ao dar refresh em `/admin/...`                  | `public/_redirects` não foi commitado ou `dist/_redirects` não gerou. |
| `Failed to fetch` para Supabase                     | Site URL / Redirect URL não configurados no Supabase Auth para o novo domínio. |
| Login redireciona para URL antiga                   | Redirect URL antiga (Lovable/preview) ainda cadastrada no Supabase Auth. |
| Turnstile falha silenciosamente                     | `TURNSTILE_SECRET_KEY` ausente no Supabase, ou domínio novo não adicionado ao widget no painel Cloudflare Turnstile. |
| Assets carregam com MIME errado                     | Você publicou em Worker em vez de Pages, ou hospedou o `dist` em outro servidor sem MIME correto. |
| Build falha com "Variáveis públicas ausentes"       | Confirme as duas variáveis `VITE_SUPABASE_*` em Production **e** Preview do Cloudflare Pages. |

## 11. Limitações conhecidas

- **`backup-to-sheets`** depende do gateway `connector-gateway.lovable.dev`
  e da conexão Google Sheets provisionada pelo Lovable. Fora do ambiente
  Lovable essa função específica não terá `LOVABLE_API_KEY` válida — o
  frontend segue funcionando normalmente; apenas o backup automático para
  planilha ficará indisponível até reescrever a função para chamar a Google
  Sheets API diretamente com credenciais próprias.
- Autenticação, RLS, storage de assinaturas, contratos, PDFs, todas as
  operações administrativas e todas as demais Edge Functions funcionam
  normalmente fora do Lovable.
