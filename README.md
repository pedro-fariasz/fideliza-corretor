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

O schema completo está em [`backend/migrations/001_initial_schema.sql`](backend/migrations/001_initial_schema.sql).

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
4. Rode a migration no Supabase: abra o projeto → **SQL Editor** → cole o conteúdo de
   `backend/migrations/001_initial_schema.sql` → execute. O script é idempotente
   (pode ser reexecutado sem duplicar nada).
5. Suba os servidores de desenvolvimento:
   ```bash
   npm run dev
   ```
   (no `backend/` e no `frontend/`, em terminais separados)

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

## Licença

Proprietary — todos os direitos reservados.
