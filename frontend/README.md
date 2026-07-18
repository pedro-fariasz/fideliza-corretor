# Fideliza Corretor — Frontend (Fase 1)

Frontend mínimo em React + Vite + TailwindCSS. Quatro telas: login, cadastro de
cliente, lista de clientes com selo de score e filtro de cadastros incompletos.

## Regras de arquitetura (não violar)

- O Supabase no frontend serve **só para login** (Supabase Auth), com a chave
  publishable/anon. A service role key **nunca** entra aqui.
- Todo dado de cliente passa pela API do backend, sempre com
  `Authorization: Bearer <access_token>`. O `tenant_id` vem do JWT no backend —
  o frontend nunca o envia.
- O frontend **não calcula** o score de completude — apenas exibe o
  `score_completude` que a API retorna.

## Como rodar

1. Instale as dependências:

   ```bash
   cd frontend
   npm install
   ```

2. Configure o ambiente:

   ```bash
   copy .env.example .env   # (Windows) ou: cp .env.example .env
   ```

   Preencha no `.env`:
   - `VITE_SUPABASE_URL` — URL do projeto Supabase
   - `VITE_SUPABASE_ANON_KEY` — chave publishable/anon (só login)
   - `VITE_API_URL` — URL do backend (local: `http://localhost:3000`; produção: URL do Railway)

3. Rode o dev server:

   ```bash
   npm run dev
   ```

   Acesse http://localhost:5173. O backend precisa estar rodando e o
   `CORS_ORIGIN` do backend precisa incluir `http://localhost:5173`.

## Pré-requisitos para logar

O usuário precisa existir no **Supabase Auth** (Authentication > Users) e ter um
perfil na tabela `users` com o **mesmo id** do Auth e um `tenant_id` válido —
sem isso a API responde 403.

## Consentimento de aniversário (LGPD + Meta)

O formulário coleta o consentimento "aceita felicitação de aniversário por
WhatsApp" e envia `aceita_felicitacao_aniversario` no POST. A coluna é criada
pela migration `backend/migrations/002_consentimento_felicitacao.sql` — rode-a
no SQL Editor do Supabase junto com a 001. O cron da Fase 3 só poderá disparar
a felicitação quando esse campo for `TRUE`.

## Rodando na nuvem (Railway)

O frontend vira um serviço próprio no Railway (separado do backend):

1. No Railway: **New Service → GitHub Repo**, com **Root Directory** = `frontend`.
2. Em **Variables**, defina as mesmas três variáveis do `.env.example`:
   - `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (iguais em todos os ambientes)
   - `VITE_API_URL` = URL pública do serviço do **backend** no Railway
     (ex.: `https://fideliza-backend.up.railway.app`)
3. O Railway roda `npm install` + `npm run build` e inicia com `npm start`
   (serve o build com fallback de SPA — as rotas `/login`, `/clientes/novo`
   funcionam ao recarregar a página).
4. No serviço do **backend**, inclua a URL pública do frontend no
   `CORS_ORIGIN` (separada por vírgula da origem local), ex.:
   `CORS_ORIGIN=http://localhost:5173,https://fideliza-frontend.up.railway.app`

> As variáveis `VITE_*` são embutidas no build. Se mudar alguma no Railway,
> faça um **Redeploy** para o novo valor valer.

## Usando em dois computadores

- **Para usar o sistema** (cadastrar/consultar clientes): abra a URL do
  frontend no Railway em qualquer navegador — nada precisa ser instalado.
- **Para desenvolver**: cada computador clona o repositório, roda `npm install`
  e cria seu próprio `frontend/.env` a partir do `.env.example` (o `.env` não
  vai para o git). Os valores de Supabase são os mesmos; o `VITE_API_URL` pode
  apontar para o backend local ou para o do Railway.
