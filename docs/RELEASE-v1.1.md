# 🚀 Fideliza Corretor — Release v1.1

**Tema:** do funil de vendas ao **pós-venda completo** — reter, renovar, medir e gerenciar equipe.
**Entregue em:** 5 fases sequenciais, cada uma atrás de *feature flag*, sem quebrar o que já existia.
**Qualidade:** 60 testes automatizados verdes · builds limpos · isolamento multi-tenant preservado em toda query.

## Visão geral
O v1.0 cobria o **antes da venda** (lead → funil → venda → comissão). O v1.1 adiciona todo o **depois da venda** — onde mora a receita recorrente da corretagem — mais o controle de acesso que sustenta uma conta com vários usuários.

---

## Fase 0 — Usuários, papéis e permissões
*Fundação de controle de acesso (migration 009).*
- **3 papéis de conta:** Administrador · Corretor · Secretária (sem acesso a valores).
- **Hierarquia de corretor:** Vendedor · Líder · Gerente, via `lider_id` — cada nível enxerga um escopo de dados.
- **Matriz de permissões única** (`config/permissoes.js`), checada **no servidor** (403, nunca redirect silencioso).
- **Escopo hierárquico** (`escopoService`): toda listagem passa por um helper de escopo — nunca só no front.
- **Gestão de Equipe:** criar corretor/secretária, editar, desativar **transferindo a carteira** (não apaga dados).
- Menu lateral renderiza dinamicamente por papel; valores monetários ocultos para a secretária.

## Fase 1 — Gestão de Carteira
*O relacionamento contínuo (migration 010).*
- Nova entidade **apólice** (contrato recorrente): venda **gera** apólice; apólice **renova** preservando histórico (`apolice_mae_id`).
- **Pipeline por vencimento:** Vencidas · Urgentes (≤15d) · Em atenção (16-45d) · Em dia · Canceladas.
- **7 métricas + Score Geral** (TRC, LTV, NPS, PPC, TCC, RPC, TMR) com metas e pesos do brief.
- **Health score individual** por cliente, recalculado por **job diário**.
- **Negócio avulso**, **renovação** (recalcula comissões) e **cancelamento com motivo** (alimenta o churn).

## Fase 2 — Pós-Vendas (Timeline Inteligente)
*A esteira automática (migration 011).*
- 6 etapas configuráveis (Boas-vindas D+1 → Satisfação D+30 → Expansão D+45 → Pré-Renovação D-60 → Renovação D-0 → Aniversário) com gatilhos por venda/renovação/vencimento/aniversário.
- **Pipeline + Lista** que movem o cliente sozinho via **job diário**.
- **Configurador de fluxos** e **editor de mensagens** por categoria (templates de fábrica + restaurar padrão).
- **"Enviar via WhatsApp"** abre `wa.me/` com a mensagem renderizada (`[NOME] [PRODUTO] [VENCIMENTO] [VALOR] [CORRETOR]`).

## Fase 3 — BI de Carteira / Inteligência
*Visão 360° da base (migration 012).*
- **Job noturno** grava agregados; a tela **lê o agregado** com cache de 15 min + fallback lazy.
- **Cards de topo**, **insights determinísticos com CTA clicável**, **4 gráficos SVG** (health, receita 6 meses, categoria, projeção de renovações).
- **Receita garantida vs. em risco**, **análise de churn (top 20)** e **ranking de cross-sell**.

## Fase 4 — Desempenho de Equipe
*Comparar vendedores, achar concentração de risco (on-read, sem migration).*
- Cards, gráfico por vendedor, evolução mensal (3 séries), **destaques automáticos**.
- **Índice de Concentração** (top 3 ÷ total) com alerta se > 70%.
- **Ranking ordenável** com conversão do funil e taxa de renovação — respeitando o escopo de cada papel.

---

## Modelo de dados adicionado
| Migration | Tabelas / colunas |
|---|---|
| 009 | `users`: `papel_conta`, `cargo`, `lider_id`, `ativo`, `ultimo_acesso` |
| 010 | `carteira_clientes`, `apolices`, `carteira_agregados`; `produtos.vigencia_meses` |
| 011 | `posvendas_etapas`, `posvendas_status`, `posvendas_mensagens` |
| 012 | `carteira_agregados`: `periodo`, `dados_json` (+ índices) |

## Superfície de API (novos endpoints)
- `/api/equipe` — gestão de usuários (só administrador).
- `/api/carteira` — pipeline, métricas, apólices, negócio avulso, renovar, cancelar.
- `/api/posvendas` — pipeline, lista, fluxos, mensagens, marcar feito, cross-sell, mensagem (wa.me).
- `/api/bi-carteira` — painel de inteligência + `/corretores`.
- `/api/desempenho` — painel de desempenho + `/vendedores`.
- `/api/jobs/recalcular-carteira`, `/recalcular-posvendas`, `/recalcular-bi` — jobs de cron (header `x-job-secret`).

## Configuração de produção
- **Feature flags (backend):** `FEATURE_EQUIPE`, `FEATURE_CARTEIRA`, `FEATURE_POSVENDAS`, `FEATURE_BI_CARTEIRA`, `FEATURE_DESEMPENHO`.
- **Jobs de cron** (`npm run cron` → `scripts/run-jobs.js`, protegido por `JOB_SECRET`): `recalcular-carteira`, `recalcular-posvendas`, `recalcular-bi` — diário às 06:00 UTC.
- **Serviços Railway:** backend (`main`), frontend (`main`), `cron-jobs`.
- **Ordem de deploy por fase:** aplicar a migration no Supabase → ligar a flag no backend → (se houver) agendar/rodar o job.

---

## Fica para o v1.2 (deferido de propósito)
- **Metas de desempenho** (Fase 4 sem metas, por decisão do brief).
- **Convite por e-mail com link de senha** (hoje o admin define a senha no modal).
- **Escopo do líder recursivo** (hoje 1 nível — subordinados diretos).
- **Comissão dupla na UI** (o schema já tem `beneficiario`; a UI usa só `corretor`).
- **Metas de LTV/RPC por vertical** (hoje alvos padrão ajustáveis em `carteiraMetricsService`).
- **Interações-90d no health score** (hoje entram via pós-venda; refino possível).
- **Fluxo de pós-venda por produto** (o schema suporta override por `produto_id`; a UI configura por categoria).

---

## Notas técnicas transversais
- **Multi-tenant sempre:** toda query filtra por tenant (isolamento app-layer, sem RLS).
- **Permissão no servidor:** esconder botão no front nunca é controle de acesso.
- **Feature flag por fase:** permite deployar código sem expor módulo incompleto.
- **Jobs assíncronos:** health score, movimentação de etapas e agregados de BI rodam em cron, nunca em request.
- **Sem lib de gráfico nova:** os dashboards usam SVG puro, reaproveitando o design system existente.
