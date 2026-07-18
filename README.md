# Fideliza Corretor

SaaS multi-tenant de **pós-venda para corretores independentes de plano de saúde** no Brasil.
O corretor cadastra o cliente uma vez e o sistema cuida do relacionamento sozinho — mensagens
de WhatsApp e e-mail no momento certo, alertas de situações urgentes e consultas em linguagem
natural via agente no WhatsApp. Não é cotador nem plataforma de vendas: é pós-venda puro,
guiado pelo princípio **"set and forget"**.

> Fonte de verdade completa do projeto: [`docs/INSTRUCOES-PROJETO.md`](docs/INSTRUCOES-PROJETO.md)

## Stack

| Camada | Tecnologia | Motivo |
|---|---|---|
| Frontend | React + Vite + TailwindCSS | Stack padrão de mercado, rápida para iterar telas. |
| Backend | Node.js + Express | Simples, direto e com ecossistema maduro para APIs. |
| Banco | Supabase (PostgreSQL) | Postgres gerenciado com Auth embutido; service role key no backend. |
| E-mail | Resend | API de e-mail simples e barata para disparos transacionais. |
| WhatsApp | Meta Cloud API oficial (direta) | Sem intermediário; mensagens utility na janela de 24h são gratuitas. |
| IA | Claude API (Anthropic) | Extração de dados de PDF + agente conversacional. |
| Hospedagem | Railway (plano pago) | Cron jobs não podem hibernar. |
| Pagamentos | Stripe | Cobrança recorrente das mensalidades. |
| DNS/SSL | Cloudflare | DNS e certificados sem custo. |
| Monitoramento | Sentry (Fase 7) | Rastreio de erros quando houver escala. |

## Arquitetura

```
┌──────────────────┐        ┌──────────────────────┐
│  Frontend (React │  HTTPS │   Backend (Node.js   │
│  + Vite +        ├───────►│   + Express)         │
│  TailwindCSS)    │  JWT   │   Railway            │
└──────────────────┘        └──────────┬───────────┘
                                       │
          ┌────────────────┬───────────┼───────────────┬──────────────────┐
          ▼                ▼           ▼               ▼                  ▼
   ┌────────────┐   ┌────────────┐  ┌────────┐  ┌───────────────┐  ┌────────────┐
   │  Supabase  │   │   Resend   │  │ Claude │  │ Meta Cloud    │  │   Stripe   │
   │ (Postgres) │   │  (e-mail)  │  │  API   │  │ API direta    │  │ (Fase 6)   │
   │ service    │   │            │  │ (IA)   │  │ (WhatsApp)    │  │            │
   │ role key   │   │            │  │        │  │               │  │            │
   └────────────┘   └────────────┘  └────────┘  └───────────────┘  └────────────┘
```

## Modelo de dados

| Tabela | Descrição |
|---|---|
| `tenants` | Cada corretor (ou corretora) é um tenant — raiz do isolamento multi-tenant, com plano e contador de consultas do mês. |
| `users` | Perfil de aplicação do usuário (tenant e papel admin/membro); credenciais ficam no Supabase Auth. |
| `clientes` | Carteira do corretor: dados do titular, plano, datas, `score_completude` e `churn_score`. |
| `alertas` | Alertas agendados (aniversário do plano, boleto, follow-up, churn etc.) com status e canal. |
| `historico_disparos` | Registro de cada mensagem efetivamente disparada, ligado ao alerta de origem. |
| `sessoes_whatsapp` | Contexto de conversa do agente WhatsApp, com TTL de 30 minutos de inatividade. |
| `templates` | Templates de mensagem por tenant, tipo e canal (WhatsApp/e-mail). |

O schema completo está em [`backend/migrations/`](backend/migrations/) — rode as
migrations em ordem numérica (001, 002, ...).

## Setup local

1. Clone o repositório:
   ```bash
   git clone https://github.com/pedro-fariasz/fideliza-corretor.git
   cd fideliza-corretor
   ```
2. Instale as dependências do backend e do frontend:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
3. Copie o `.env.example` para `.env` e preencha as chaves (Supabase, Resend, Meta WhatsApp, Claude API):
   ```bash
   cp .env.example .env
   ```
4. Rode as migrations no Supabase: abra o projeto → **SQL Editor** → cole e execute,
   em ordem, o conteúdo de `backend/migrations/001_initial_schema.sql` e
   `backend/migrations/002_consentimento_felicitacao.sql`. Os scripts são
   idempotentes (podem ser reexecutados sem duplicar nada).
5. Configure também o `.env` do frontend: `cd frontend && cp .env.example .env`
   e preencha `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon, só login) e
   `VITE_API_URL` (backend local ou do Railway).
6. Suba os servidores de desenvolvimento:
   ```bash
   npm run dev
   ```
   (no `backend/` e no `frontend/`, em terminais separados)

## Rodando na nuvem (Railway)

Dois serviços no mesmo projeto Railway, apontando para este repositório:

| Serviço | Root Directory | Start | Variáveis |
|---|---|---|---|
| backend | `backend` | `npm start` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `CORS_ORIGIN` |
| frontend | `frontend` | `npm start` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` |

- `VITE_API_URL` do frontend = URL pública do serviço backend.
- `CORS_ORIGIN` do backend deve listar **todas** as origens usadas, separadas por
  vírgula — o frontend do Railway e o local de desenvolvimento, ex.:
  `http://localhost:5173,https://fideliza-frontend.up.railway.app`.
- Com o frontend no ar, qualquer computador usa o sistema pelo navegador — a
  instalação local só é necessária para desenvolver.

## Estrutura de pastas

```
backend/src/
  routes/         — define endpoints
  controllers/    — orquestra request → service → response
  services/       — regras de negócio
  repositories/   — acesso ao banco (TODA query filtra por tenant_id)
  middlewares/    — auth, validação, erro
  migrations/     — SQL versionado
frontend/src/
  pages/          — telas
  components/     — componentes reutilizáveis
  hooks/          — lógica de estado
  services/       — chamadas à API
```

## Convenções de código

- **Idioma:** inglês para variáveis/funções; português para conteúdo voltado ao usuário (UI, mensagens, templates).
- **Tabelas e colunas:** português snake_case, com os nomes exatos do modelo de dados.
- **`tenant_id` vem sempre do JWT** do usuário autenticado — nunca do body da requisição.
- **Chaves em variáveis de ambiente** — nunca hardcoded.
- **Erros logados com contexto** (tenant_id, cliente_id quando aplicável).
- **Commits pequenos e frequentes**, mensagens em português.

## ⚠️ Aviso de segurança — Isolamento de tenant

O backend usa a **service role key** do Supabase, que **bypassa a Row Level Security por
completo**. Por isso o schema **não** cria RLS policies: o isolamento entre tenants depende
**exclusivamente** do filtro `WHERE tenant_id = $tenantId` na camada de **repositories**.

- Toda query DEVE ter esse filtro, sem exceção.
- O `tenant_id` é extraído do JWT do usuário autenticado — nunca confiar no body da requisição.
- Query sem `tenant_id` = parar e corrigir antes de continuar.

## Fases de construção

| Fase | Entrega | Status |
|---|---|---|
| 1 — Base + Completude | Supabase multi-tenant, formulário web, score de completude | pendente |
| 2 — E-mail automático | Cron + Resend + templates | pendente |
| 3 — WhatsApp | Meta Cloud API, agente básico, sessões | pendente |
| 4 — Frontend React | Dashboard, telas definitivas, editor de templates | pendente |
| 5 — Agente completo | RAG, teto de consultas, extração de PDF assíncrona | pendente |
| 6 — Churn + Pagamento | Churn score, onboarding de tenant, Stripe, painel admin | pendente |
| 7 — Escala | Sentry, relatórios, landing page | pendente |

**Regra: não pular fases.** Cada fase tem um teste com usuário real antes de avançar.

## Testando o backend localmente

Pré-requisitos: migrations `001` e `002` já rodadas no Supabase e um
`.env` no `backend/` preenchido a partir do `.env.example` (precisa apenas de
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `PORT` e
`CORS_ORIGIN` para a Fase 1).

Instale as dependências e suba a API:

```bash
cd backend
npm install
npm run dev
```

### 1. Criar um usuário no Supabase Auth

No painel do Supabase: **Authentication → Users → Add user** (marque
*Auto Confirm User*). Guarde o e-mail, a senha e o `id` (UUID) gerado.

### 2. Vincular o usuário ao tenant demo

Rode no **SQL Editor** do Supabase, garantindo o tenant demo e ligando o perfil:

```sql
INSERT INTO tenants (id, nome, email)
VALUES ('00000000-0000-0000-0000-000000000000', 'Tenant Demo', 'demo@fideliza.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, tenant_id, email, role)
VALUES (
  '<ID_DO_USUARIO_DO_AUTH>',
  '00000000-0000-0000-0000-000000000000',
  '<EMAIL_DO_USUARIO>',
  'admin'
);
```

### 3. Obter um access token

Use a `SUPABASE_ANON_KEY` para trocar e-mail/senha por um `access_token`:

```bash
curl -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"seu@email.com","password":"suasenha"}'
```

Copie o `access_token` da resposta.

### 4. Chamar a API

```bash
# Criar cliente (só nome é obrigatório)
curl -X POST http://localhost:3000/api/clientes \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Maria Souza",
    "telefone_whatsapp": "+5511999998888",
    "data_inicio_plano": "2024-03-01",
    "operadora": "SulAmérica",
    "email": "maria@example.com",
    "tipo_plano": "PF"
  }'

# Listar clientes do tenant (com filtro de incompletos)
curl "http://localhost:3000/api/clientes?incompletos=true" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

O `score_completude` retorna calculado pelo backend; qualquer valor enviado no
body é ignorado.

## Licença

Proprietary — todos os direitos reservados.
