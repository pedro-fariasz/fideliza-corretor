# Instruções do Projeto — CRM SaaS para Corretores de Plano de Saúde

## Quem sou eu

Sou Pedro, estou construindo um SaaS do zero usando Claude Code e IA. Meu nível técnico: sei o básico de programação e vou construir com auxílio de IA. Prefiro explicações práticas e diretas, em português do Brasil, sem jargão desnecessário. Quando houver decisão técnica a tomar, apresente as opções com prós e contras e recomende uma.

A primeira usuária do sistema é minha mãe, corretora de plano de saúde — ela é a cliente beta que valida tudo com dados reais antes de eu vender para outros corretores.

## O Produto

**Nome provisório:** Fideliza Corretor

**O que é:** SaaS vertical de pós-venda para corretores independentes de plano de saúde no Brasil. O corretor cadastra o cliente uma vez e o sistema cuida do relacionamento automaticamente — mensagens de WhatsApp e e-mail no momento certo, alertas de situações urgentes, consultas em linguagem natural via agente no WhatsApp.

**O problema que resolve:** corretores perdem clientes por falta de acompanhamento pós-venda — reajustes não comunicados, boletos vencidos sem aviso, aniversários esquecidos, sinistralidade alta ignorada até a operadora reclamar. O corretor foca em vender; ninguém cuida da base.

**O que NÃO é:** não é cotador, não é plataforma de vendas, não compete com as ferramentas das operadoras. É pós-venda puro.

**Mercado-alvo:** corretor individual com 50–500 clientes, crescendo até pequenas corretoras com equipe. Público com baixa familiaridade com tecnologia — quanto menos o corretor precisar pensar, melhor.

**Modelo de negócio:** implementação (R$497–997 única) + mensalidade (Essencial R$97/mês, Profissional R$197/mês).

## Filosofia do Produto (decisões já tomadas — não reabrir sem motivo forte)

**Web é o canal principal de cadastro.** Formulário completo, upload de PDF/planilha, painel gerencial. Mais confiável que captura de dados por chat.

**WhatsApp de cadastro é opcional.** Existe para quando o corretor acabou de fechar uma venda e quer registrar na hora. Manda o PDF ou dados básicos, o agente confirma e salva. Ele completa depois no web.

**O agente WhatsApp faz consultas e alertas — não substitui o formulário.** Consultas em linguagem natural ("quando vence o boleto do Pedro Farias?") e recebimento de alertas urgentes. É onde ele ganha o dia a dia do corretor.

**Um número de WhatsApp central da plataforma.** Todos os corretores falam com o mesmo número. O mesmo número dispara mensagens automáticas para os clientes dos corretores. WhatsApp Cloud API oficial da Meta obrigatória (nunca Z-API/Evolution — risco de banimento em massa e violação dos termos da Meta).

**Multi-tenant desde a primeira linha de código.** Cada corretor é um tenant isolado. TODO query no backend filtra por tenant_id, sem exceção. Isso não é otimização futura — é fundação.

**Set and forget.** O corretor cadastra uma vez e o sistema trabalha sozinho para sempre. Toda feature deve ser avaliada por essa lente: reduz ou aumenta o esforço contínuo do corretor?

## Entrada de clientes por tipo de plano

| Tipo | Fluxo |
|---|---|
| PME | Corretor sobe PDF do contrato → Claude API extrai os dados → corretor confirma → salvo |
| PF (individual/familiar) | Sobe planilha da operadora (só tem nome + vigência) → sistema importa → corretor completa o resto |
| Adesão | Não gera documento → formulário manual no web |
| PJ | A definir em fase posterior |

Um "cliente" no sistema = titular do plano/empresa + quantidade de dependentes (não cadastramos cada dependente individualmente).

## Stack Técnica (definida — não trocar sem discussão)

| Camada | Tecnologia |
|---|---|
| Frontend | React + Vite + TailwindCSS |
| Backend | Node.js + Express |
| Banco | Supabase (PostgreSQL) — service role key no backend |
| E-mail | Resend |
| WhatsApp | WhatsApp Cloud API oficial da Meta (direto, sem Twilio/360dialog) |
| IA | Claude API (Anthropic) — extração de PDF + agente conversacional |
| Hospedagem | Railway (plano pago — cron jobs não podem hibernar) |
| Pagamentos | Stripe |
| DNS/SSL | Cloudflare |
| Monitoramento | Sentry (Fase 7) |

**⚠️ REGRA CRÍTICA DE SEGURANÇA — Isolamento de Tenant:**
O backend usa a **service role key** do Supabase, que **bypassa Row Level Security completamente**. O isolamento entre tenants depende EXCLUSIVAMENTE do filtro `WHERE tenant_id = $tenantId` na camada de repositories. Toda query DEVE ter esse filtro, sem exceção. Nunca confiar em tenant_id vindo do body da requisição — sempre extrair do token JWT do usuário autenticado. Se uma query for gerada sem tenant_id, parar e corrigir antes de continuar.

**Decisão tomada — WhatsApp:** Meta Cloud API direta (não Twilio, não 360dialog). Motivos: sem intermediário, mensagens utility dentro da janela de 24h são gratuitas, e no beta usamos o número de teste da Meta (até 5 destinatários verificados) antes da verificação de negócio para produção.

**Decisão tomada — Agente:** agente conversacional em Node.js customizado, NÃO n8n. Motivo: lógica de tenant, sessão, RAG e controle de custo viram espaguete em n8n.

## Modelo de Dados

```sql
tenants
  id, nome, email, plano, status, criado_em, consultas_mes_atual

users
  id, tenant_id, email, role (admin | membro), criado_em

sessoes_whatsapp
  id, numero_telefone, tenant_id, contexto_json, ultima_atividade
  -- TTL: expira após 30 min de inatividade

clientes
  id, tenant_id
  nome, cpf, telefone_whatsapp, email
  operadora, tipo_plano (PF | PME | Adesao | PJ)
  plano_nome, valor_mensalidade
  data_inicio_plano       -- vigência / aniversário do plano
  data_encerramento
  data_aniversario        -- aniversário do titular
  carencia_meses
  vencimento_boleto       -- dia do mês
  nivel_sinistralidade    -- baixo | medio | alto
  qtd_dependentes
  status                  -- ativo | inadimplente | cancelado
  score_completude        -- 0-100, calculado ao salvar
  churn_score             -- 0-100, calculado no cron diário
  ultimo_contato_em
  notas, criado_em

alertas
  id, tenant_id, cliente_id
  tipo    -- aniversario_plano | aniversario_cliente | boleto_disponivel
          -- boleto_atraso | sinistralidade | follow_up | renovar_contato | churn_alto
  canal   -- whatsapp | email | painel
  agendado_para, status (pendente | enviado | falhou | ignorado)
  tentativas, enviado_em, erro

historico_disparos
  id, tenant_id, cliente_id, alerta_id
  canal, conteudo_enviado, status, criado_em

templates
  id, tenant_id, tipo, canal, conteudo, ativo
```

## Regras de Negócio Críticas

### Score de completude (Fase 1 — inegociável)

- Calculado automaticamente ao salvar qualquer cliente
- **Obrigatórios (bloqueiam alertas se vazios):** nome, telefone_whatsapp, data_inicio_plano, operadora
- **Importantes (−10% cada):** data_aniversario, email, tipo_plano
- **Complementares (−5% cada):** nivel_sinistralidade, data_encerramento, carencia_meses, qtd_dependentes
- **Score < 60%:** agente lembra o corretor dos campos faltantes
- **Score < 40%:** alertas automáticos suspensos para aquele cliente (falha silenciosa é inaceitável)

### Alertas automáticos (para o cliente do corretor)

| Tipo | Quando | Canal |
|---|---|---|
| Aniversário do plano (reajuste) | 30 dias antes da vigência anual | WhatsApp + E-mail |
| Aniversário do cliente | No dia, às 9h | WhatsApp |
| Boleto disponível | Dia configurável do mês | WhatsApp + E-mail |
| Follow-up pós-venda | 7 dias após cadastro | WhatsApp |

### Alertas para o corretor

| Tipo | Quando | Urgência |
|---|---|---|
| Boleto em atraso | Status → inadimplente | Alta |
| Sinistralidade alta | Campo → alto | Alta |
| Churn score alto | Score > 70 | Alta |
| Renovar contato | Último contato > 60 dias | Média |
| Cadastro incompleto | Completude < 60% | Informativa |

### Churn score (Fase 6 — feature do plano Profissional)

Calculado no cron diário, SQL puro, sem ML:
- +40 pontos: boleto em atraso > 7 dias
- +30 pontos: sinistralidade = alto
- +20 pontos: último contato > 60 dias
- +10 pontos: reajuste em < 30 dias

🔴 70–100 risco alto (agente avisa o corretor) | 🟡 40–69 médio | 🟢 0–39 saudável

### Cron diário (7h) com idempotência

1. Busca alertas status=pendente e agendado_para <= hoje
2. Verifica por alerta.id se já foi enviado ANTES de disparar (nunca duplicar)
3. Dispara → atualiza status → registra em historico_disparos
4. Gera alertas do próximo ciclo
5. Recalcula churn_score e score_completude

### Agente WhatsApp

- Identificação por CPF na primeira mensagem; sessão em sessoes_whatsapp com TTL de 30 min
- **RAG obrigatório:** antes de chamar a Claude API, buscar no banco APENAS os clientes relevantes para a pergunta (SELECT com filtro por nome/contexto). Nunca mandar a carteira inteira no prompt. Meta: ~2k tokens por consulta.
- **Teto de consultas por plano:** Essencial 50/mês, Profissional 200/mês. Ao atingir: alertas continuam, consultas pausam com mensagem convidando ao upgrade.
- **Extração de PDF é assíncrona:** recebe → "processando..." → fila → Claude API → confirma. Nunca travar o webhook esperando a API.

## Ordem de Construção (seguir esta sequência)

| Fase | Semanas | Entrega |
|---|---|---|
| 1 — Base + Completude | 1–2 | Supabase multi-tenant, formulário web, score de completude. Mãe cadastrando clientes reais |
| 2 — E-mail automático | 3 | Cron + Resend + templates. Primeiros disparos automáticos |
| 3 — WhatsApp | 4–5 | Meta Cloud API (número de teste → produção), agente básico com 5 consultas, sessões |
| 4 — Frontend React | 6–8 | Dashboard, telas definitivas, editor de templates |
| 5 — Agente completo | 9–10 | RAG, teto de consultas, extração de PDF assíncrona, cadastro via WhatsApp |
| 6 — Churn + Pagamento | 11–14 | Churn score, onboarding de tenant, Stripe, painel admin |
| 7 — Escala | ongoing | Sentry, relatórios, landing page |

**Regra: não pular fases. Cada fase tem um teste com usuário real antes de avançar.**

## Convenções de Código

- **Idioma do código:** inglês para variáveis/funções, português para conteúdo voltado ao usuário (mensagens, templates, UI)
- **Nomes de tabelas e campos:** português snake_case (já definidos no modelo acima — manter consistência)
- **Toda rota autenticada valida o tenant_id do usuário logado** — NUNCA confiar em tenant_id vindo do body da requisição
- **Variáveis de ambiente para todas as chaves** (Supabase, Resend, Meta WhatsApp, Claude API, Stripe) — nunca hardcoded
- **Errors sempre logados com contexto** (tenant_id, cliente_id quando aplicável)
- **Commits pequenos e frequentes** com mensagens descritivas em português

## Como me ajudar nas conversas deste projeto

- Quando eu pedir código, entregue completo e funcional — não trechos soltos
- Aponte quando eu estiver prestes a violar uma decisão já tomada (ex: query sem tenant_id)
- Se uma feature nova surgir, avalie contra a filosofia "set and forget" e a fase atual antes de implementar
- Me lembre de testar com minha mãe ao final de cada fase
- Custos importam: estou bootstrapped. Sempre estime custo operacional de decisões novas
