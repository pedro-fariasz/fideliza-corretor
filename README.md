# Fideliza Corretor

CRM SaaS multi-tenant para corretores de planos de saúde. Ajuda o corretor a
gerenciar sua carteira de clientes, disparar lembretes automáticos (vencimento,
aniversário, renovação, inadimplência) e conversar com clientes usando um
assistente com RAG sobre a base de clientes.

## Arquitetura

- **Multi-tenant**: cada corretor é um `tenant`. Todo dado é isolado por
  `tenant_id`.
- **Isolamento na aplicação**: **não** usamos RLS (Row Level Security). O
  backend é responsável por sempre filtrar as queries por `tenant_id`.
- **Banco**: PostgreSQL (Supabase).

## Estrutura do projeto

```
.
├── backend/
│   └── migrations/
│       └── 001_initial_schema.sql   # Schema inicial (tabelas, índices, seeds)
├── .env.example                     # Modelo de variáveis de ambiente
└── README.md
```

## Modelo de dados

| Tabela      | Descrição                                                        |
|-------------|------------------------------------------------------------------|
| `tenants`   | Corretores/corretoras — raiz do isolamento multi-tenant.         |
| `clientes`  | Segurados de cada corretor (núcleo do CRM). CPF é opcional.      |
| `alertas`   | Lembretes gerados por cliente (vencimento, renovação, etc.).     |
| `historico` | Histórico de interações (mensagens, ligações, notas).            |
| `sessoes`   | Sessões de conversa do bot/atendimento, indexadas por telefone.  |
| `templates` | Templates de mensagens reutilizáveis por tenant.                 |

### Detalhes relevantes

- UUIDs de chave primária gerados com `gen_random_uuid()`.
- `clientes.atualizado_em` é mantido automaticamente por trigger em cada UPDATE.
- `clientes.vencimento_boleto` aceita apenas valores de 1 a 31 (dia do boleto).
- Busca de clientes por nome usa índice GIN + trigrama (`pg_trgm`) para o
  fluxo de RAG.
- Índice parcial `idx_alertas_pendentes` acelera a fila de alertas pendentes.

## Como aplicar o schema

### Opção 1 — Supabase SQL Editor

1. Abra o **SQL Editor** do seu projeto no Supabase.
2. Cole o conteúdo de `backend/migrations/001_initial_schema.sql`.
3. Execute. O script é idempotente e já cria o tenant demo com templates padrão.

### Opção 2 — psql

```bash
psql "$DATABASE_URL" -f backend/migrations/001_initial_schema.sql
```

## Configuração

1. Copie o arquivo de exemplo de variáveis de ambiente:

   ```bash
   cp .env.example .env
   ```

2. Preencha as credenciais do Supabase, chaves de IA e demais valores.

3. O tenant de desenvolvimento já vem semeado com o UUID fixo
   `00000000-0000-0000-0000-000000000000` (ver `TENANT_DEMO_ID`).

## Dados de seed

O schema cria automaticamente:

- **Tenant demo** (`Corretor Demo`) com UUID fixo.
- **5 templates padrão**: boas-vindas, lembrete de vencimento, aniversário,
  cobrança/inadimplência e renovação.

Os placeholders dos templates (ex.: `{{nome}}`, `{{plano}}`,
`{{vencimento_boleto}}`) são substituídos pela aplicação no envio.
