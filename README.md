# Fideliza Corretor

SaaS **multi-tenant** de pós-venda para corretores independentes de plano de saúde no Brasil.
O corretor cadastra o cliente uma vez e o sistema cuida do relacionamento sozinho
(WhatsApp, e-mail, alertas) — princípio **"set and forget"**.

## Stack

| Camada     | Tecnologia                                              |
|------------|---------------------------------------------------------|
| Frontend   | React + Vite + TailwindCSS                              |
| Backend    | Node.js + Express                                       |
| Banco      | Supabase (PostgreSQL) — **service role key** no backend |
| E-mail     | Resend                                                  |
| WhatsApp   | Meta Cloud API oficial (integração direta)             |
| IA         | Claude API (extração de PDF + agente conversacional)    |
| Host       | Railway (plano pago — cron não hiberna)                 |

## ⚠️ Regra crítica — Isolamento de tenant

O backend usa a **service role key** do Supabase, que **bypassa a RLS por completo**.
O isolamento entre tenants depende **exclusivamente** de `WHERE tenant_id = $tenantId`
na camada de **repositories**. Toda query precisa desse filtro, sem exceção, e o
`tenant_id` vem **sempre do JWT** do usuário autenticado — nunca do body da requisição.

> Por isso o schema **não** cria RLS policies: o isolamento é feito na aplicação.

## Estrutura de pastas

```
backend/src/
  routes/         # define endpoints, extrai tenant_id do JWT
  controllers/    # orquestra request -> service -> response
  services/       # regras de negócio (score, alertas, cron)
  repositories/   # acesso ao banco — TODA query filtra por tenant_id
  middlewares/    # auth, validação, tratamento de erro
backend/migrations/  # SQL versionado (Supabase)
frontend/src/
  pages/          # telas
  components/     # componentes reutilizáveis
  hooks/          # lógica de estado
  services/       # chamadas à API
```

## Banco de dados

O schema inicial está em [`backend/migrations/001_initial_schema.sql`](backend/migrations/001_initial_schema.sql).

**Como aplicar no Supabase:**

1. Abra o projeto no Supabase → **SQL Editor**.
2. Cole o conteúdo de `001_initial_schema.sql` e execute.
3. O script habilita a extensão `uuid-ossp`, cria as tabelas
   (`tenants`, `usuarios`, `clientes`, `alertas`, `historico`, `sessoes`, `templates`),
   os índices, o gatilho de `atualizado_em` e insere um **tenant demo**
   (UUID `00000000-0000-0000-0000-000000000000`) com templates padrão.

O script é idempotente (`IF NOT EXISTS` / `ON CONFLICT`), então pode ser reexecutado sem erro.

## Score de completude

Calculado ao salvar o cliente:

- **Obrigatórios** (bloqueiam alertas se vazios): `nome`, `telefone_whatsapp`, `data_inicio_plano`, `operadora`.
- **Importantes** (−10% cada): `data_aniversario`, `email`, `tipo_plano`.
- **Complementares** (−5% cada): `nivel_sinistralidade`, `data_encerramento`, `carencia_meses`, `qtd_dependentes`.
- Score **< 60%**: o agente lembra o corretor dos campos faltantes.
- Score **< 40%**: alertas automáticos suspensos para aquele cliente.

## Configuração

Copie `.env.example` para `.env` e preencha os valores. **Nunca** commite o `.env`.

```bash
cp .env.example .env
```

## Fase atual — Fase 1 (Base + Score de completude)

Escopo atual: Supabase multi-tenant, formulário web de cadastro, cálculo do score
de completude, lista de clientes com filtro "incompletos".

Fora de escopo agora: cron/e-mail (F2), WhatsApp/agente (F3), frontend definitivo (F4),
RAG/teto de consultas/PDF (F5), churn score/Stripe (F6).
