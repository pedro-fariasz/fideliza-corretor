# O que fazer no Supabase — MVP do CRM de vendas

> Passo-a-passo pra deixar o banco pronto pro MVP. Projeto Supabase: `fideliza-crm` (São Paulo).
> Tempo estimado: ~15 minutos. Nada aqui apaga dado existente — só **acrescenta**.

## Antes de começar
- As migrations **001–005** já estão aplicadas (é o que está em produção hoje).
- Estamos **adicionando** as migrations **006** e **007**. Elas são **idempotentes** (pode rodar de novo sem quebrar nada).
- **Não** mexemos em RLS (continua desligada; isolamento é no backend por `tenant_id`).

## Passo 1 — Aplicar a migration 006 (CRM de vendas)
1. Supabase → **SQL Editor** → **New query**.
2. Cole o conteúdo de `backend/migrations/006_crm_vendas.sql`.
3. **Run**.
4. Cria as tabelas: `leads`, `produtos`, `vendas`, `comissoes`, `interacoes`, `compromissos` e adiciona colunas em `tenants` (`vertical`, `trial_termina_em`, `asaas_customer_id`, `asaas_subscription_id`).

## Passo 2 — Aplicar a migration 007 (PDF da proposta)
1. SQL Editor → **New query**.
2. Cole `backend/migrations/007_arquivos_propostas.sql`.
3. **Run**.
4. Cria a tabela `arquivos` **e** o bucket de storage privado `propostas`.

> Se o `INSERT INTO storage.buckets` der erro de permissão no seu plano, crie o bucket pela UI:
> **Storage → New bucket → nome `propostas` → "Public bucket" DESMARCADO → Create.**

## Passo 3 — Conferir que deu certo
No SQL Editor, rode:
```sql
-- Devem aparecer as 7 tabelas novas:
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('leads','produtos','vendas','comissoes','interacoes','compromissos','arquivos')
order by table_name;

-- Colunas novas em tenants:
select column_name from information_schema.columns
where table_schema='public' and table_name='tenants'
  and column_name in ('vertical','trial_termina_em','asaas_customer_id','asaas_subscription_id');

-- Bucket privado criado:
select id, public from storage.buckets where id = 'propostas';   -- public deve ser 'false'
```

## Passo 4 — Storage (nada a configurar além do bucket)
- O bucket `propostas` é **privado**. Não precisa criar policies.
- O backend acessa como `service_role` (bypassa RLS de storage) e gera **URL assinada** de curta duração quando o corretor precisa ver o PDF.
- Convenção de caminho do arquivo: `<tenant_id>/<uuid>.pdf` — o `tenant_id` no início reforça o isolamento.

## Passo 5 — Variáveis de ambiente (Railway → serviço do backend)
Pro cadastro via PDF funcionar, o backend precisa de:
- `ANTHROPIC_API_KEY` — chave da Claude API (extração do PDF). **Nova.**
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` — **já existem, não sobrescrever** (foi o que causou o 401 antes).
- Storage usa a mesma `SUPABASE_SERVICE_ROLE_KEY` (o client de storage do Supabase usa a mesma key).

Pra assinatura (quando chegar nesse módulo):
- `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` — **novas** (decisão de provedor ainda pendente; ver INSTRUCOES).

## Passo 6 — Sem seed obrigatório
As tabelas novas nascem vazias. O tenant demo (`00000000-…`) continua existindo das migrations antigas. Cada corretor cria seus próprios produtos/leads.

---

## Resumo do que muda em cada serviço

| Serviço | O que fazer agora | Observação |
|---|---|---|
| **Supabase** | Rodar migrations 006 e 007 (SQL Editor) + confirmar bucket `propostas` privado | Nada é destrutivo; idempotente |
| **Railway** | Adicionar `ANTHROPIC_API_KEY` no backend. Subir pro plano **Hobby** antes da Fase 2 (cron não pode hibernar) | **Nunca** sobrescrever `SUPABASE_*`, `CORS_ORIGIN`, `VITE_*` |
| **Resend** | Sem mudança estrutural agora. Verificar domínio próprio quando for enviar e-mail de lembrete de compromisso / credenciais | Já era pendência |

> **Ordem recomendada de implementação** (backend): reaproveitar `auth` que já existe → `produtos` (o cérebro da comissão) → `leads` → `funil` (muda estágio + escreve interação) → `vendas`+`comissoes` (o cálculo, com os 3 casos de teste) → `dashboard` → `agenda` → cadastro via PDF (storage + fila + Claude API) → assinatura.
