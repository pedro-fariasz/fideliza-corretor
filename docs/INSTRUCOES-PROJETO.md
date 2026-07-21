# Instruções do Projeto — Fideliza Corretor (CRM de vendas para corretores)

> **Mudança de rumo — 21/07/2026.** Este documento foi reescrito. O Fideliza
> nasceu como SaaS de **pós-venda puro só de plano de saúde** ("set and forget").
> Por decisão do Pedro, agora é um **CRM de vendas multi-vertical** para corretores
> (consórcio, seguro, plano de saúde, imobiliário). O escopo detalhado do MVP está
> em `docs/PRD-fideliza-corretor.md` — este arquivo é o contexto de projeto que o
> acompanha. O que era pós-venda (esteira, alertas, score de completude) foi
> **reposicionado para v2**.

## Quem sou eu
Sou Pedro, construindo um SaaS com Claude Code e IA. Nível técnico: básico de programação, construindo com auxílio de IA. Prefiro explicações práticas e diretas, em português do Brasil, sem jargão. Em decisão técnica, apresente opções com prós e contras e recomende uma. Custos importam: estou bootstrapped — sempre estime o custo operacional de decisões novas.

## O Produto

**Nome:** Fideliza Corretor (`pedro-fariasz/fideliza-corretor`).

**O que é:** CRM SaaS para corretores autônomos brasileiros gerenciarem **leads, funil de vendas e comissões**, num só lugar, começando por **uma vertical**.

**Promessa (MVP):** *"Do primeiro contato até a comissão recebida, num só lugar, em menos de 5 minutos de cadastro."*

**O problema que resolve:** corretor hoje usa WhatsApp + planilha + memória. Perde lead por falta de follow-up, perde comissão por falta de controle, e não sabe qual canal de captação converte.

**Diferenciais do MVP:**
1. **Cálculo de comissão que faz sentido pro mercado BR** — parcelada ou recorrente, com percentual e **data de início do pagamento configuráveis**. É a dor #1 do corretor autônomo.
2. **Cadastro do cliente via PDF da proposta** — o corretor sobe o PDF que já tem em mãos, a **Claude API extrai** os dados (nome, telefone, produto, valor…), e o corretor **confirma** antes de salvar. Zero digitação.

**O que NÃO é (no MVP):** não é ferramenta de pós-venda automatizado, não tem BI avançado, não tem WhatsApp com IA, não é gestor de carteira/renovações. Tudo isso é roadmap (v1.1/v2).

## Persona-alvo do MVP
Corretor autônomo brasileiro, 28–50 anos, 1–3 anos de mercado, **uma vertical principal**. Trabalha 60% no celular. Já usa WhatsApp Business e planilha pra comissão. Não confia em quanto vai receber mês que vem. Aceita pagar ~R$60/mês por algo que resolva isso **de verdade**. **Não é** persona do MVP: escritório com 10+ corretores, gerente comercial, seguradora grande (isso é v2).

**Primeira validadora:** a mãe do Pedro (corretora) — cliente beta que valida com dados reais antes de vender pra outros. Testar com ela ao fim de cada fase.

## Filosofia do Produto (decisões — não reabrir sem motivo forte)
- **Cadastro rápido acima de tudo.** Menos de 5 minutos, e idealmente zero digitação (via PDF).
- **Clareza de comissão é sagrada.** Se o cálculo estiver errado, o corretor perde a confiança e cancela. Os casos de teste de comissão do PRD (§6.5) são obrigatórios antes de lançar.
- **Multi-tenant desde a primeira linha.** Cada conta é um tenant isolado. TODO query filtra por `tenant_id`. Fundação, não otimização futura.
- **MVP enxuto.** Cada feature cortada vale 2–6 semanas. O MVP precisa ser lançável em 3–4 meses solo. Não puxar escopo de v1.1/v2.

## Stack Técnica (mantida do projeto atual — reaproveita a fundação)

| Camada | Tecnologia |
|---|---|
| Frontend | React + Vite + TailwindCSS |
| Backend | Node.js + Express |
| Banco | Supabase (PostgreSQL) — service role key no backend |
| Storage | Supabase Storage — bucket privado `propostas` |
| E-mail | Resend |
| IA | Claude API (Anthropic) — extração do PDF da proposta |
| Pagamentos | **Asaas** (sugestão do PRD: Pix nativo, BR-first) — **decisão final pendente** (Stripe era a escolha anterior) |
| Hospedagem | Railway (plano pago — cron não hiberna) |
| Monitoramento | Sentry (free tier) |
| WhatsApp (v2.5) | **Meta Cloud API oficial** — nunca Evolution/Z-API (risco de banimento em massa) |

> **Nota sobre stack:** o PRD lista sugestões (Next.js/Prisma/Clerk). A decisão foi **manter a stack atual** (React+Vite / Node+Express / Supabase), porque a fundação de **auth + multi-tenant + isolamento** já existe e funciona — trocar de stack jogaria isso fora. Reaproveitar > recomeçar.

**⚠️ REGRA CRÍTICA DE SEGURANÇA — Isolamento de Tenant:**
O backend usa a **service role key** do Supabase, que **bypassa RLS completamente**. O isolamento depende EXCLUSIVAMENTE de `WHERE tenant_id = $tenantId` na camada de repositories. Toda query DEVE ter esse filtro. Nunca confiar em `tenant_id` do body — sempre extrair do JWT. Query sem `tenant_id` = parar e corrigir.

## Papéis e Autenticação (já implementado — migrations 001/003/004)

Login único via Supabase Auth; o comportamento muda por perfil.

| Papel (`users.role`) | Como nasce | Tenant | Acesso |
|---|---|---|---|
| `corretor` | Self-signup público → `status='ativo'`, cria o próprio tenant | Próprio | Só a própria conta — **perfil central do MVP** |
| `funcionario` | Signup na área da equipe → `status='pendente'` | Plataforma `1111…1111` | Painel interno após aprovação |
| `admin` | Allowlist `equipe_pre_aprovada` ou aprovado por outro admin | Plataforma | Painel interno + aprovar funcionários |

- **`is_platform_admin`** (migration 004): flag ortogonal ao `role`, super-admin da plataforma (Pedro). Marcador reservado; nenhuma rota exige ainda; nunca bypassa `tenant_id`.
- **Guardas** (`middlewares/roles.js`, após `authMiddleware`): `requireAtivo`, `requireInternal`, `requireAdmin`.
- **NÃO usamos RLS**: isolamento é app-layer.
- **v1.1:** hierarquia comercial (Vendedor/Líder/Gerente) e papel **Secretária**. **Não** implementar no MVP.

### Exceção de Isolamento (única autorizada)
O **painel interno** da equipe Fideliza consulta dados cross-tenant. Vive em `repositories/internalRepository.js`, atrás de `requireInternal`, sob `/api/admin/*`. Nenhum outro lugar pode repetir esse padrão.

## Modelo de Dados

### Tabelas do MVP CRM (migrations 006–007)

```sql
tenants  (já existe + colunas novas)
  id, nome, email, plano, status, criado_em, atualizado_em
  vertical                -- consorcio | seguro | saude | imobiliario (vertical principal)
  trial_termina_em        -- fim do trial de 14 dias
  asaas_customer_id, asaas_subscription_id

users  (já existe)
  id, tenant_id, email, role, status, is_platform_admin, criado_em

leads
  id, tenant_id, dono_id
  nome (NOT NULL), tipo_pessoa (PF|PJ), empresa, cpf_cnpj, telefone, email
  interesse, origem_especifica
  estagio (prospectos|qualificados|proposta_enviada|negociacao|finalizacao|venda_concluida)
  probabilidade, valor_estimado
  origem_cadastro (manual|pdf), observacoes, ultimo_contato_em
  criado_em, atualizado_em

produtos
  id, tenant_id, nome, categoria (consorcio|seguro|saude|imobiliario), descricao
  tipo_comissao (limitada|recorrente), parcelas_limite, percentual
  inicio_pagamento (mes_seguinte|mesmo_mes), dia_pagamento, ativo
  criado_em, atualizado_em

vendas
  id, tenant_id, lead_id, produto_id, vendedor_id
  valor, forma_pagamento (debito|boleto|pix|cartao|dinheiro|outro)
  data_venda, status (concluida|cancelada), observacoes
  criado_em, atualizado_em

comissoes         -- 1 venda -> N parcelas
  id, tenant_id, venda_id
  beneficiario (corretor|corretora)   -- comissão dupla já modelada; UI do MVP só usa 'corretor'
  percentual, valor_parcela, num_parcela, total_parcelas
  data_prevista, data_recebida, status (projetada|recebida|cancelada)
  criado_em, atualizado_em

interacoes        -- timeline do lead; o funil escreve sozinho
  id, tenant_id, lead_id, usuario_id
  tipo (nota|ligacao|whatsapp|email|reuniao|sistema|mudanca_estagio), descricao, criado_em

compromissos      -- agenda simples
  id, tenant_id, usuario_id, lead_id
  titulo, descricao, data_inicio, data_fim, lembrete_enviado
  criado_em, atualizado_em

arquivos          -- PDF da proposta + extração da IA
  id, tenant_id, lead_id, tipo, storage_path, nome_original, mime_type, tamanho_bytes
  status_extracao (processando|concluida|falhou), dados_extraidos_json, erro
  criado_em, atualizado_em
```

**Decisões-chave embutidas:**
- `tenant_id` em TODAS (inclusive `comissoes`, que é consultada direto em relatórios).
- `comissoes` separada de `vendas` → "comissão a receber por mês" sem gambiarra.
- `beneficiario` prepara a **comissão dupla** no banco desde já (UI só na v1.1).
- `arquivos.lead_id` é nullable: o PDF pode existir antes de o lead ser salvo.

### Tabelas legadas (pós-venda — fora do MVP)
`clientes`, `alertas`, `historico_disparos`, `templates`, `sessoes_whatsapp` permanecem no banco (migrations 001–002) mas **sem uso ativo no MVP**. Voltam quando o Pós-Vendas entrar (v2).

## Regras de Negócio Críticas

### Cálculo de comissão (inegociável — testar antes de lançar)
Ao registrar a venda de um produto:
- `tipo_comissao = 'limitada'` com N parcelas → gera **N** registros em `comissoes`, cada um `valor_parcela = venda.valor * percentual / N`.
- `tipo_comissao = 'recorrente'` → gera **12** parcelas iniciais (limite MVP), renovação manual depois.
- **1ª parcela:** `mes_seguinte` → dia 5 do mês seguinte à venda; `mesmo_mes` → `dia_pagamento` do mês da venda (se já passou, joga pro mês seguinte). Parcelas seguintes: intervalo mensal.

**Casos de teste obrigatórios:**
1. Consórcio 30 parcelas de 1,5%, R$ 100k → 30 comissões de R$ 50.
2. Seguro auto 1 parcela de 20%, R$ 3k → 1 comissão de R$ 600, mês seguinte.
3. Saúde recorrente 5%, R$ 800/mês → 12 comissões de R$ 40, a partir do mês seguinte.

### Venda nasce do funil
Mover o card do lead para **"Venda Concluída"** abre o modal de venda (produto, valor, forma de pagamento). Só ao confirmar cria a `venda` + as parcelas de `comissoes`. Cancelar → card volta ao estágio anterior. Toda mudança de estágio grava uma `interacao` automática.

### Cadastro via PDF da proposta (assíncrono)
Upload → grava `arquivos` (`status_extracao='processando'`) → worker chama a Claude API em background → preenche `dados_extraidos_json` → tela de **confirmação** com os campos pré-preenchidos → corretor revisa e salva o lead (`origem_cadastro='pdf'`). **A IA nunca cria o lead sozinha.** Falha de leitura → cai no cadastro manual com o PDF anexado. Bucket `propostas` é privado; acesso só via URL assinada gerada pelo backend (LGPD).

### Trial e assinatura
Signup → `trial_termina_em = hoje + 14`, conta `ativo`. Fim do trial sem assinatura → `status='suspenso'`, login bloqueado com CTA de assinatura. Falha de cobrança → 3 tentativas em 7 dias, depois suspende.

## Ordem de Construção (MVP → v1.1 → v2)

| Fase | Entrega |
|---|---|
| **MVP** (mês 1–4) | Auth+conta+trial · Leads (manual + PDF) · Funil Kanban · Produtos+comissão · Venda+comissões · Dashboard · Agenda · Assinatura (Asaas) |
| **v1.1** (mês 5–6) | Comissão dupla na UI · Secretária · Renovações/Carteira · Central de Prioridades · Import em lote · Fechamento PDF · Plano anual · Notificações in-app |
| **v2** (mês 7–12) | BI completo · Simulador de consórcio · Gerador de propostas PDF · Pós-Vendas (esteira) · Despesas · Landing page · Desempenho · Hierarquia |
| **v2.5** (mês 13+) | WhatsApp com IA (Meta Cloud API) · Extrator Google Maps · Tracking Meta/Google Ads |

**Regra: não pular fases. Cada fase tem teste com usuário real antes de avançar.**

## Métricas de sucesso do MVP (90 dias pós-lançamento)
100 trials iniciados · conversão trial→pago ≥ 15% · churn mensal ≤ 10% · DAU/MAU ≥ 30% · ≥ 3 vendas/conta pagante/mês · NPS informal ≥ 40. Se algo ficar muito abaixo: falar com 10 clientes antes de escrever código novo.

## Identidade Visual
- **Fundo branco/claro é o padrão de TODAS as telas** (login incluído). Dark mode só **pós-login** (`localStorage`, `data-theme="dark"`).
- Tokens (Tailwind v4, `@theme` em `frontend/src/index.css`): `brand-blue #1E5EFF` (primária), `brand-blue-dark #174EA6` (hover), `brand-navy #0F1B2D` (texto destaque), `brand-amber #F5A623` (destaque pontual — nunca fundo grande/botão). Texto sobre `brand-blue` = branco.
- Tipografia: Poppins (headings), Inter (corpo). Logos em `frontend/src/assets/logo/`, `<Logo />` — não recriar.

## Convenções de Código
- Código em inglês; conteúdo pro usuário em português.
- Tabelas/colunas em português snake_case (nomes exatos do modelo acima).
- Toda rota autenticada valida o `tenant_id` do JWT — nunca do body.
- Chaves em variáveis de ambiente, nunca hardcoded.
- Erros logados com contexto (`tenant_id`, `lead_id`/`venda_id`).
- Commits pequenos e frequentes, mensagens em português.

## Como me ajudar
- Código completo e funcional, não trechos soltos.
- Me avise quando eu estiver prestes a violar decisão tomada (query sem `tenant_id`, puxar escopo de fase futura).
- Avalie feature nova contra o MVP enxuto e a clareza de comissão antes de implementar.
- Me lembre de testar com minha mãe ao fim de cada fase.
- Estime custo operacional de decisões novas (incl. custo de tokens da extração de PDF).

## Changelog
- **21/07/2026** — **Virada de produto:** de pós-venda puro (saúde) para **CRM de vendas multi-vertical**. Novo PRD (`docs/PRD-fideliza-corretor.md`) com escopo MVP (auth, leads, funil, produtos/comissão, vendas, dashboard, agenda, assinatura) + cadastro de lead via PDF da proposta. Migrations 006 (CRM de vendas) e 007 (arquivos/propostas + bucket). Pós-venda (esteira/alertas/score) reposicionado para v2; tabelas legadas mantidas sem uso ativo. `CLAUDE.md` e este documento reescritos.
- **20/07/2026** — Painel interno, papéis corretor/funcionario/admin, `is_platform_admin`, exceção de isolamento, identidade visual, GRANT service_role (migration 005). *(Ver histórico do git para o detalhe da fase pós-venda anterior.)*
