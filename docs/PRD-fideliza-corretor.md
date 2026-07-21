# PRD — Fideliza Corretor (v1)

> **Documento de produto** — especificação funcional modular para implementação.
> Não é análise competitiva nem código: é a base para virar backlog, telas e migrations.
> Autor: PM + arquitetura (assistido). Owner e decisor final: **Pedro**.
> Data: 21/07/2026 · Repositório: `pedro-fariasz/fideliza-corretor`

---

## ⚠️ Leia antes de tudo — mudança de escopo em relação ao Fideliza atual

O Fideliza **hoje documentado** (`docs/INSTRUCOES-PROJETO.md`, `CLAUDE.md`) é um **SaaS de pós-venda puro, vertical único (plano de saúde)**, sob a filosofia *set and forget* — e diz explicitamente *"não é plataforma de vendas"*. Está em **Fase 1** (base multi-tenant + score de completude), com produção no ar.

Este PRD, a pedido do owner, especifica um **CRM de vendas completo e multi-vertical** (consórcio, seguros, plano de saúde, imobiliário), espelhando a categoria representada pelo `crm-corretor.top`. **Isso é uma expansão de fundação, não um incremento de fase.** As implicações (posicionamento, precificação, esforço, e o risco de canibalizar o "set and forget") estão consolidadas em **[§19 Perguntas para o owner](#19-perguntas-para-o-owner)** e devem ser decididas **antes** de qualquer implementação além do MVP.

Onde o relatório do concorrente conflita com decisões suas já cravadas, este PRD **mantém a sua decisão** e sinaliza:

| Tema | Concorrente (referência) | Decisão Fideliza (mantida) | Onde |
|---|---|---|---|
| WhatsApp | Evolution API / Z-API | **Meta Cloud API oficial** (nunca Evolution/Z-API — risco de banimento em massa) | [§13](#13-canais-de-captura) |
| Isolamento | (não exposto) | **`tenant_id` em toda query** (service role bypassa RLS) | [§1](#1-autenticação-e-papéis) |
| Preço | Per-seat R$59/usuário | Modelado, mas **decisão em aberto** vs. implementação + R$97/197 | [§16](#16-assinatura-e-billing) · [§19](#19-perguntas-para-o-owner) |
| Pós-venda | Esteira genérica | **Diferencial central do Fideliza** — score de completude + set and forget | [§10](#10-pós-vendas) |

---

## Sumário

- [Convenções e legendas](#convenções-e-legendas)
- [1. Autenticação e papéis](#1-autenticação-e-papéis)
- [2. Dashboard](#2-dashboard)
- [3. Leads](#3-leads)
- [4. Funil Kanban](#4-funil-kanban)
- [5. Central de Prioridades](#5-central-de-prioridades)
- [6. Inteligência do Funil (BI)](#6-inteligência-do-funil-bi)
- [7. Produtos e regras de comissão](#7-produtos-e-regras-de-comissão)
- [8. Vendas e comissões](#8-vendas-e-comissões)
- [9. Renovações / Gestão de Carteira](#9-renovações--gestão-de-carteira)
- [10. Pós-Vendas](#10-pós-vendas)
- [11. Gerador de Propostas + Simulador de Consórcio](#11-gerador-de-propostas--simulador-de-consórcio)
- [12. Despesas](#12-despesas)
- [13. Canais de Captura](#13-canais-de-captura)
- [14. Agenda](#14-agenda)
- [15. Desempenho](#15-desempenho)
- [16. Assinatura e billing](#16-assinatura-e-billing)
- [17. Configurações e ajuda](#17-configurações-e-ajuda)
- [18. Roadmap sugerido](#18-roadmap-sugerido)
- [19. Perguntas para o owner](#19-perguntas-para-o-owner)
- [Apêndice A — Modelo de dados consolidado](#apêndice-a--modelo-de-dados-consolidado)
- [Apêndice B — Listas estratégicas (origem e interesse)](#apêndice-b--listas-estratégicas-origem-e-interesse)

---

## Convenções e legendas

- **Idioma:** PT-BR em tudo voltado ao usuário (labels, mensagens). Código em inglês; tabelas/colunas em **português snake_case** (mantém o padrão do banco atual).
- **Isolamento:** toda tabela de negócio tem `tenant_id`; **toda query filtra por `tenant_id`** (vindo do JWT, nunca do body). Única exceção: painel interno cross-tenant (`requireInternal`), já existente.
- **MoSCoW:** **Must** (MVP não lança sem), **Should** (entra logo após), **Could** (desejável), **Won't** (fora do MVP, fica pra v2).
- **Sugestão de stack** aparece rotulada como *(sugestão)* — o owner decide. Stack base já definida: React+Vite+Tailwind / Node+Express / Supabase / Resend / Meta Cloud API / Claude API / Railway / Stripe.
- **"Vertical"** = ramo de atuação: `consorcio | seguro | saude | imobiliario`. Muitos campos e templates variam por vertical.

---

## 1. Autenticação e papéis

### Objetivo de negócio
Um login único que atende dono de carteira, equipe de vendas e suporte administrativo, com visibilidade proporcional ao papel e isolamento total entre corretoras (tenants).

### User stories principais
- Como **corretor autônomo**, quero me cadastrar sozinho e já começar a usar, para não depender de aprovação.
- Como **admin de corretora**, quero criar vendedores e secretárias e definir a hierarquia, para controlar quem vê o quê.
- Como **secretária**, quero ver a agenda da equipe e os leads (sem valores de comissão), para dar suporte sem acessar dados sensíveis.
- Como **plataforma Fideliza**, quero um painel interno cross-tenant, para dar suporte e acompanhar a saúde da base.

### Telas e componentes
- **Login** (fundo claro, sem dark mode — regra de identidade), **Cadastro de corretor** (self-service público), **Recuperar senha**.
- **Área da equipe interna** (`/equipe/*`) para signup de funcionário (nasce `pendente`).
- **Gestão de usuários** (dentro do tenant): abas **Corretores/Vendedores** e **Secretárias**.
- **Painel interno Fideliza** (`/api/admin/*`, `requireInternal`): lista de corretores + Kanban read-only de clientes por corretor (já existe).
- Shell de navegação **muda por papel** (Admin vê tudo; Corretor sem itens administrativos; Secretária só agenda + leitura de leads).

### Papéis (dois eixos ortogonais)
**Eixo 1 — papel de plataforma (`users.role`, já implementado):**

| Papel | Nasce | Tenant | Acesso |
|---|---|---|---|
| `corretor` | Self-signup público → `ativo` na hora, cria o próprio tenant | Próprio | Só a própria carteira |
| `funcionario` | Signup na área da equipe → `pendente` | Plataforma (`1111…1111`) | Painel interno após aprovação |
| `admin` | Allowlist `equipe_pre_aprovada` ou aprovado por outro admin | Plataforma | Painel interno + aprovar funcionários |
| `is_platform_admin` | Flag (migration 004), super-admin (Pedro) | — | Reservado; nenhuma rota exige ainda |

**Eixo 2 — cargo dentro da corretora (novo, para CRM de vendas):** `users.cargo` ∈ `vendedor | lider | gerente`.
Define o **alcance da visão "Equipe"**: `vendedor` vê só o próprio; `lider` vê o próprio subgrupo; `gerente` vê todos da corretora. **Secretária** é um cargo à parte (`cargo = secretaria`) com acesso fixo restrito.

> ⚠️ **Não confundir** `role` (papel de plataforma/interno) com `cargo` (hierarquia comercial dentro do tenant). São eixos independentes. O `corretor` dono do tenant é implicitamente `gerente`.

### Campos e validações

**Cadastro de corretor (público):**

| Campo | Tipo | Obrig. | Regra |
|---|---|---|---|
| nome | texto | ✅ | 3–120 chars |
| email | email | ✅ | único; vira login |
| whatsapp | telefone | ✅ | E.164; máscara BR |
| senha | senha | ✅ | mín. 8, 1 número |
| verticais_atuacao | multiseleção | ✅ | ≥1 de consórcio/seguro/saúde/imobiliário — define quais módulos/templates aparecem |
| nome_corretora | texto | ❌ | opcional (PJ) |

**Cadastro de vendedor/secretária (feito pelo admin do tenant):**

| Campo | Tipo | Obrig. | Regra |
|---|---|---|---|
| nome, email, whatsapp | — | ✅ | idem acima |
| senha / confirmar | senha | ✅ | conferem entre si |
| cargo | seleção | ✅ (vendedor) | `vendedor \| lider \| gerente`; secretária não tem cargo hierárquico |
| lider_id | ref users | ❌ | obrigatório se `cargo=vendedor` e a corretora usa subgrupos |

### Regras de negócio
- `authMiddleware` extrai `tenant_id` + perfil do **JWT**; `requireAtivo` bloqueia `status != 'ativo'` por rota (o `/me` responde mesmo pendente).
- **Secretária** nunca acessa comissões, vendas nem funil de valores — apenas agenda (completa) e leads (leitura).
- Convite de usuário envia credenciais por e-mail (Resend) — **ação com efeito externo**, confirmar fluxo antes de disparar em produção.
- Cadastro de corretor gera tenant + registro em `users` numa transação; falha em qualquer etapa faz rollback.

### Dependências
Base de tudo. Nenhuma dependência para cima; todos os módulos dependem deste.

### Modelo de dados sugerido
`tenants` (já existe) · `users` (já existe; **adicionar** `cargo`, `lider_id`, `verticais_atuacao` no tenant/opcional no user) · `equipe_pre_aprovada` (já existe).

### Integrações externas
Supabase Auth (login) · Resend (convite/credenciais).

### Priorização MoSCoW
| Item | Nível |
|---|---|
| Login único + self-signup corretor + isolamento `tenant_id` | **Must** |
| Cadastro de vendedor + cargo (vendedor/líder/gerente) | **Must** |
| Secretária com acesso restrito | **Should** |
| Subgrupos por líder (`lider_id`) | **Could** |
| Painel interno cross-tenant | **Should** (já existe base) |

### Riscos e decisões abertas
- **Multi-usuário por tenant** muda o modelo atual (hoje o corretor ≈ tenant). Precisa definir se o MVP já vende para corretoras com equipe ou só autônomos (ver [§19](#19-perguntas-para-o-owner)).
- Alcance exato do "líder" (subgrupo) precisa de regra explícita antes de codar o BI por equipe.

---

## 2. Dashboard

### Objetivo de negócio
Dar ao corretor, em 5 segundos, o pulso do negócio: quanto vendeu, quanto vai receber de comissão, o que está no funil e o que fazer hoje.

### User stories principais
- Como **corretor**, quero ver vendas, comissão e conversão do período, para saber se o mês está bom.
- Como **gerente**, quero alternar entre "minha agenda" e "equipe", para acompanhar o time.
- Como **corretor**, quero atalhos para funil, vendas e leads, para navegar rápido.

### Telas e componentes
- **4 KPIs** (somente leitura, recalculam pelo filtro de período): Vendas (nº e R$), Valor dos negócios, Comissões, Total de leads + taxa de conversão.
- **Filtro de período:** data inicial/final + atalhos "Este mês / 30 dias / Este ano".
- **Gráfico "Vendas por mês"** (faturamento × comissão, últimos 6 meses fixos, não afetado pelo filtro).
- **Próximos compromissos** (abas "Minha agenda" / "Equipe"; botão "Agendar" abre modal da Agenda).
- **Funil resumido** (espelho do pipeline + "Ver funil").
- **Vendas recentes** e **Leads recentes / Origem dos leads** (com "Ver todos").

### Campos e validações
Sem formulários próprios (é agregador). Filtro de período: datas válidas, início ≤ fim.

### Regras de negócio
- Todos os números derivam de queries agregadas **filtradas por `tenant_id`** e por escopo do papel (vendedor vê o próprio; gerente vê a corretora).
- Conversão = vendas concluídas ÷ leads criados no período.
- Comissão exibida = **soma das parcelas de comissão projetadas/realizadas** no período (ver [§7](#7-produtos-e-regras-de-comissão)/[§8](#8-vendas-e-comissões)).

### Dependências
Leads (§3), Funil (§4), Vendas (§8), Agenda (§14), Produtos (§7).

### Modelo de dados sugerido
Nenhuma tabela nova; leituras agregadas. *(Sugestão: views/materialized views por tenant se performance apertar.)*

### Integrações externas
Nenhuma.

### Priorização MoSCoW
| Item | Nível |
|---|---|
| 4 KPIs + filtro de período | **Must** |
| Vendas recentes / Leads recentes | **Must** |
| Gráfico vendas por mês | **Should** |
| Aba "Equipe" nos compromissos | **Should** |
| Origem dos leads (mini-BI) | **Could** |

### Riscos e decisões abertas
- Performance de agregação em tenants grandes — decidir entre cálculo on-the-fly vs. cache.

---

## 3. Leads

### Objetivo de negócio
Cadastro rápido do potencial cliente, capturando **origem específica** e **interesse** — os dois campos que alimentam o BI e a decisão de onde investir marketing.

### User stories principais
- Como **corretor**, quero cadastrar um lead em menos de 30s, para não perder o timing do contato.
- Como **corretor**, quero registrar de onde o lead veio (canal específico), para saber qual mídia converte.
- Como **corretor**, quero marcar o interesse (produto/vertical), para priorizar e alimentar relatórios.

### Telas e componentes
- **Modal "Novo Lead"** (acessível do cabeçalho e de dentro do Kanban).
- **Lista/Tabela de leads** (`leads.php` equivalente) com filtros e ordenação.
- **Ficha do lead** (detalhe): dados, histórico de interações, compromissos, timeline de estágio.

### Campos e validações

| Campo | Tipo | Obrig. | Regra |
|---|---|---|---|
| tipo_pessoa | toggle | ✅ | `PF` (CPF) / `PJ` (CNPJ); muda campos exigidos |
| nome | texto | ✅ | 3–120 |
| empresa | texto | ❌ | recomendado se PJ |
| cpf_cnpj | texto | ❌ | válido conforme tipo_pessoa (validação dígito) |
| email | email | ❌ | formato válido |
| telefone | telefone | ⚠️ | E.164; **recomendado forte** (sem telefone o lead é quase inútil) |
| interesse | seleção | ✅ | `consorcio \| seguro \| imovel \| saude` (alimenta BI "produto de interesse") |
| origem_especifica | seleção | ✅ | lista longa granular (ver [Apêndice B](#apêndice-b--listas-estratégicas-origem-e-interesse)) |
| estagio | seleção | ✅ | default "Prospectos" |
| probabilidade | número % | ❌ | 0–100; default = probabilidade padrão do estágio |
| responsavel_id | ref users | ✅ | default = usuário logado |
| observacoes | texto longo | ❌ | livre |

### Regras de negócio
- **`tenant_id` sempre do JWT.** `responsavel_id` default = quem cadastrou.
- Ao criar, `estagio` inicial gera `probabilidade` padrão daquele estágio (usada no forecast ponderado do BI).
- **Dedupe (Should):** avisar se já existe lead com mesmo telefone/CPF no tenant.
- Origem `extrator` / `whatsapp` / `landing` são preenchidas **automaticamente** pelos canais (§13), não manualmente.
- **Score de atividade/saúde** do lead (Ativo/Atenção/Crítico/Urgente/Inativo) é calculado pelo mesmo motor da Central de Prioridades (§5).

### Dependências
Usuários (§1). Alimenta Funil (§4), Central de Prioridades (§5), BI (§6), Propostas (§11).

### Modelo de dados sugerido
`leads` — `id, tenant_id, responsavel_id, tipo_pessoa, nome, empresa, cpf_cnpj, email, telefone, interesse, origem_especifica, estagio, probabilidade, status_saude, valor_estimado, observacoes, ultimo_contato_em, criado_em, atualizado_em`.
`lead_interacoes` — `id, tenant_id, lead_id, user_id, tipo (ligacao|whatsapp|email|reuniao|nota), conteudo, criado_em`.

### Integrações externas
Nenhuma direta (origens automáticas vêm do §13).

### Priorização MoSCoW
| Item | Nível |
|---|---|
| Novo Lead (campos obrigatórios) + lista | **Must** |
| Origem específica + interesse (listas completas) | **Must** |
| Ficha do lead com interações | **Must** |
| Dedupe por telefone/CPF | **Should** |
| Visão tabela ordenável | **Should** |
| Importação em massa (CSV) | **Could** |

### Riscos e decisões abertas
- Telefone obrigatório ou não (impacta canais automáticos que às vezes só trazem nome).
- Granularidade da lista de origem: rica demais reduz preenchimento. Sugestão: campo com busca + "outros".

---

## 4. Funil Kanban

### Objetivo de negócio
Ser o coração operacional: o corretor move o lead pelas etapas e é **a movimentação para "Venda Concluída" que gera a venda** — não há formulário separado de venda.

### User stories principais
- Como **corretor**, quero arrastar cards entre estágios, para atualizar o pipeline sem digitar.
- Como **corretor**, quero filtrar por dono, atividade e estágio, para focar no que importa.
- Como **corretor**, ao concluir a venda, quero informar produto/valor/comissão, para registrar o faturamento.

### Telas e componentes
- **Kanban** com **6 colunas fixas:** Prospectos → Qualificados → Proposta Enviada → Negociação → Finalização → Venda Concluída.
- **Toggle Kanban/Tabela.**
- **Filtros:** dono (Meus/Equipe/Todos), atividade (Ativos/Todos), estágio (coluna específica), saúde (Ativo/Atenção/Crítico/Urgente/Inativo/Sem comissão).
- **Modal de conclusão de venda** (dispara ao soltar em "Venda Concluída"): escolhe produto, valor, comissão, forma de pagamento.

### Campos e validações
Modal de conclusão de venda:

| Campo | Tipo | Obrig. | Regra |
|---|---|---|---|
| produto_id | ref produtos | ✅ | bloqueia se não houver produto (atalho "Cadastrar produto") |
| valor_negocio | moeda | ✅ | > 0 |
| forma_pagamento | seleção | ✅ | débito/boleto/pix/cartão/dinheiro/outro |
| data_venda | data | ✅ | default hoje |
| comissao_override | moeda/% | ❌ | se produto não tem regra automática (§7) |
| vendedor_id | ref users | ✅ | default = dono do lead |

### Regras de negócio
- **Mover card → "Venda Concluída" cria registro em `vendas`** e as respectivas `comissoes` (corretor e, quando aplicável, corretora — comissão dupla, §7).
- Cada mudança de estágio grava evento em `lead_estagio_historico` (com timestamp) — base do BI de gargalos e velocidade (§6).
- Mover para trás é permitido (registra evento). Reabrir uma venda concluída **estorna** a venda/comissões (Should: pedir confirmação).
- Filtro "Ativos" exclui leads perdidos/adormecidos; "Sem comissão" isola vendas de produto sem regra de cálculo.

### Dependências
Leads (§3), Produtos (§7). Alimenta Vendas (§8), BI (§6), Pós-Vendas (§10).

### Modelo de dados sugerido
`lead_estagio_historico` — `id, tenant_id, lead_id, estagio_de, estagio_para, user_id, criado_em`.
(Venda em `vendas`, ver §8.)

### Integrações externas
Nenhuma.

### Priorização MoSCoW
| Item | Nível |
|---|---|
| Kanban 6 colunas + drag-and-drop | **Must** |
| Conclusão de venda a partir do card | **Must** |
| Histórico de estágio (timestamps) | **Must** (BI depende) |
| Filtros dono/atividade/estágio | **Must** |
| Filtro de saúde do lead | **Should** |
| Visão tabela | **Should** |

### Riscos e decisões abertas
- Estornar venda ao mover card de volta: definir política (bloquear? confirmar? só admin?).
- Drag-and-drop mobile precisa de fallback (botão "avançar estágio").

---

## 5. Central de Prioridades

### Objetivo de negócio
Transformar a base de leads numa **fila de ação diária**: quem contatar agora e qual a próxima ação — disciplina comercial guiada por score.

### User stories principais
- Como **corretor**, quero uma lista ordenada por prioridade, para não decidir manualmente quem ligar.
- Como **corretor**, quero uma meta diária de contatos, para manter ritmo.
- Como **corretor**, quero saber a próxima ação sugerida de cada lead, para agir sem pensar.

### Telas e componentes
- **Lista priorizada** (score 0–100, decrescente).
- **Filtros de próxima ação:** Fechar / Follow-up / Avançar / Ativar / Sem substatus.
- **Contador "Meta de contatos hoje"** (default 0/10).
- Ação rápida por card: registrar interação, agendar, avançar estágio.

### Campos e validações
Meta diária configurável (int ≥ 0, default 10). Registro de interação: tipo + nota (ver `lead_interacoes`, §3).

### Regras de negócio
- **Score (0–100)** recalculado a partir de: estágio do funil, dias sem contato, valor da proposta, nº de interações registradas, compromissos agendados. *(Fórmula exata a definir — sugestão de pesos abaixo, ajustável.)*
- **Próxima ação** derivada de regras: ex. estágio "Finalização" + proposta enviada → **Fechar**; sem contato > X dias → **Ativar**; estágio estagnado → **Avançar**.
- Registrar interação atualiza `ultimo_contato_em` e **incrementa o contador da meta**.

**Sugestão de composição do score (rótulo "sugestão", pesos ajustáveis):**

| Fator | Peso | Direção |
|---|---|---|
| Estágio avançado (Finalização/Negociação) | +30 | prioriza fechar |
| Valor estimado alto | +25 | prioriza ROI |
| Dias sem contato | +25 | resgata esfriando |
| Compromisso agendado próximo | +10 | não deixar cair |
| Interações recentes | +10 | quente |

### Dependências
Leads (§3), Funil (§4), Agenda (§14).

### Modelo de dados sugerido
Colunas em `leads` (`status_saude`, `proxima_acao`, `ultimo_contato_em`) recalculadas por job. `meta_contatos_diaria` em `users` ou config do tenant. `contatos_do_dia` derivado de `lead_interacoes` (contagem por dia).

### Integrações externas
Nenhuma.

### Priorização MoSCoW
| Item | Nível |
|---|---|
| Lista ordenada por score | **Should** (MVP pode lançar com ordenação simples) |
| Registro de interação + atualização de contato | **Must** |
| Meta diária de contatos | **Could** |
| Próxima ação automática | **Should** |

### Riscos e decisões abertas
- **Fórmula do score precisa ser definida e validada** com a corretora (mãe do Pedro) antes de virar "verdade".
- Recalcular em tempo real vs. cron. Sugestão: cron diário + recalcular no evento de interação.

---

## 6. Inteligência do Funil (BI)

### Objetivo de negócio
Responder "onde está travando e onde investir": forecast, gargalos, melhor horário de contato e quais canais realmente convertem.

### User stories principais
- Como **gerente**, quero forecast de 30/60/90 dias, para planejar caixa.
- Como **corretor**, quero saber em qual estágio os leads empacam, para atacar o gargalo.
- Como **corretor**, quero saber qual origem gera mais venda, para cortar mídia que não converte.

### Telas e componentes
- **Seletor de escopo** (Meus dados / Minha equipe / Toda empresa) e **período** (7/30/90d, 6m, 1a, tudo).
- **Forecast ponderado** (30/60/90d) = Σ(valor × probabilidade do estágio).
- **Health Score do pipeline** + insight textual (regra ou IA generativa — ver riscos).
- **Análise de gargalos** (tempo médio de retenção por estágio).
- **Mapa de calor** de atividade por hora do dia.
- **Velocidade de 1ª resposta** (tempo até 1º contato) com benchmark citado (regra dos 5 min).
- **Cruzamentos:** origem específica × vendas; produto de interesse × conversão.

### Campos e validações
Sem formulário; só seletores (escopo/período válidos).

### Regras de negócio
- Forecast usa `probabilidade` do lead e prazo estimado por estágio.
- Gargalo = média de dias que leads passam em cada estágio (de `lead_estagio_historico`).
- Velocidade de 1ª resposta = `min(interação) − criado_em` por lead; agrega média/mediana.
- Insight "GERADO POR IA": **começar por regras determinísticas** (thresholds) e só depois, opcionalmente, camada de IA generativa para redigir o alerta (custo por chamada — Pedro é bootstrapped, ver riscos).

### Dependências
Leads (§3), Funil (§4) — **crítico: depende do histórico de estágio (§4)**. Vendas (§8).

### Modelo de dados sugerido
Nenhuma tabela nova essencial; consome `leads`, `lead_estagio_historico`, `lead_interacoes`, `vendas`. *(Sugestão: agregações materializadas por tenant.)*

### Integrações externas
Opcional: Claude API para redigir insights (rotular custo).

### Priorização MoSCoW
| Item | Nível |
|---|---|
| Forecast 30/60/90d ponderado | **Should** |
| Origem × venda / interesse × conversão | **Should** (é o "porquê" de coletar esses campos) |
| Gargalos por estágio | **Could** |
| Mapa de calor por hora | **Could** |
| Velocidade de 1ª resposta | **Could** |
| Insight por IA generativa | **Won't** (MVP) — regras primeiro |

### Riscos e decisões abertas
- **Custo de IA** para insights: manter em regras no MVP.
- BI só é útil com **volume de dados** — pouco valor no dia 1; priorizar coleta correta (§3/§4) antes da visualização.

---

## 7. Produtos e regras de comissão

### Objetivo de negócio
Produto é a espinha dorsal: funil, propostas, vendas e todo o financeiro referenciam produto. Modela **comissão dupla** (corretor × corretora) e diferentes estruturas (fixa / bônus+vitalício / diluída, limitada vs. recorrente).

### User stories principais
- Como **admin**, quero cadastrar produtos com regra de comissão, para o sistema calcular recebíveis sozinho.
- Como **admin**, quero produtos "sem regra automática", para lançar comissão manual quando ainda não sei o valor.
- Como **corretora**, quero separar a comissão do corretor da comissão da empresa, para gestão financeira correta.

### Telas e componentes
- **Lista de produtos** (ativos/inativos).
- **Modal "Adicionar produto"** (o mais complexo do sistema):
  - Toggle **"sem regra de cálculo automático"**.
  - Pastilhas de **categoria/vertical** (consórcio/seguro/saúde/imobiliário) que sugerem nomes.
  - Nome + descrição.
  - **Início do pagamento da comissão:** "Mês seguinte à venda" (default) ou "Mesmo mês" (+ dia específico).
  - **Estrutura de comissão** — aba **Comissão do Corretor**: Parcelas **Limitadas** (nº; se 1 → "Venda Única") ou **Recorrente** (sem limite); modelo de cálculo: **Fixa (%)**, **Bônus + Vitalício**, **Diluída**.
  - Aba **Comissão da Corretora** (comissão dupla) — mesma estrutura, para a empresa.
  - Checkbox **"Produto ativo (visível para vendedores)"**.

### Campos e validações

| Campo | Tipo | Obrig. | Regra |
|---|---|---|---|
| sem_regra_automatica | bool | ✅ | se true, oculta a estrutura de comissão |
| vertical | seleção | ✅ | consórcio/seguro/saúde/imobiliário |
| nome | texto | ✅ | único por tenant |
| descricao | texto | ❌ | livre |
| inicio_comissao | seleção | ✅ | `mes_seguinte \| mesmo_mes` |
| dia_pagamento | int 1–31 | cond. | obrigatório se `mesmo_mes` |
| tipo_parcelas | seleção | cond. | `limitada \| recorrente` (se tem regra) |
| qtd_parcelas | int | cond. | ≥1 se `limitada`; 1 ⇒ "venda única" |
| modelo_calculo | seleção | cond. | `fixa \| bonus_vitalicio \| diluida` |
| percentual_corretor | % | cond. | se `fixa` |
| percentual_corretora | % | ❌ | comissão dupla (aba corretora) |
| ativo | bool | ✅ | default true |

### Regras de negócio
- **Comissão dupla:** cada venda pode gerar **duas contas de comissão** — corretor (quem vendeu) e corretora (empresa). Modelar no schema **desde o início**, mesmo que a UI só exponha a aba da corretora na v1.1.
- **`qtd_parcelas = 1` ⇒ produto classificado como "Venda Única"** (consórcio/seguro de prêmio único). Recorrente = mensalidade (plano de saúde, seguro renovável).
- **Início da comissão** define quando a parcela projetada vira "a receber" nos relatórios.
- Produto **inativo** não aparece para vendedores em propostas/vendas.
- **Bônus+Vitalício** e **Diluída**: modelos de distribuição escalonada/contínua — **campos específicos a especificar com o owner** (o relatório do concorrente não expôs). MVP pode entregar só **Fixa** + toggle "sem regra".

### Dependências
Nenhuma para cima. **Bloqueia** Funil/Vendas (venda exige produto), Renovações, Propostas.

### Modelo de dados sugerido
`produtos` — `id, tenant_id, vertical, nome, descricao, sem_regra_automatica, inicio_comissao, dia_pagamento, ativo, criado_em`.
`produto_comissao_regras` — `id, tenant_id, produto_id, beneficiario ('corretor'|'corretora'), tipo_parcelas, qtd_parcelas, modelo_calculo, percentual, config_json (bônus/diluída), criado_em`.

> Nota de infra vista no concorrente ("ALTER TABLE produtos ADD COLUMN…" para comissão dupla) — aqui já nasce normalizado em `produto_comissao_regras`, evitando migração posterior.

### Integrações externas
Nenhuma.

### Priorização MoSCoW
| Item | Nível |
|---|---|
| Cadastro de produto + toggle "sem regra" | **Must** |
| Comissão Fixa (%) + parcelas limitada/recorrente | **Must** |
| Início do pagamento (mês seguinte/mesmo mês) | **Must** |
| Schema de comissão dupla (dados) | **Must** (mesmo sem UI) |
| UI da aba "Corretora" | **Should** (v1.1) |
| Modelos Bônus+Vitalício / Diluída | **Could** (v2) |

### Riscos e decisões abertas
- **Definir a matemática** de Bônus+Vitalício e Diluída antes de implementar.
- Confirmar se o MVP precisa de comissão dupla na UI ou só no dado (recomendo: **só dado no MVP**, UI na v1.1 — decisão do owner).

---

## 8. Vendas e comissões

### Objetivo de negócio
Consolidar o faturamento e os recebíveis de comissão, com fechamento financeiro por período. A venda **nasce do funil** (§4); esta tela é o registro e a gestão.

### User stories principais
- Como **corretor**, quero ver todas as vendas com filtros, para acompanhar o faturamento.
- Como **corretor**, quero registrar uma comissão avulsa, para lançar recebimentos que chegaram fora de uma venda.
- Como **admin**, quero exportar o fechamento do período, para conciliar financeiramente.

### Telas e componentes
- **Lista de vendas** com filtros: data início/fim, vendedor, status (Concluída/Pendente/Cancelada), tipo (Venda original/Renovação).
- Aviso fixo **"Comissão Dupla ativa"** + **"Adicionar Comissão"** (avulsa).
- **"Exportar Fechamento"** (arquivo do período — CSV/PDF).
- **"Registrar/Nova venda"** → redireciona ao **Funil** (a venda nasce lá).

### Campos e validações
**Comissão avulsa:**

| Campo | Tipo | Obrig. | Regra |
|---|---|---|---|
| beneficiario | seleção | ✅ | corretor / corretora |
| valor | moeda | ✅ | > 0 |
| data_recebimento | data | ✅ | — |
| venda_id | ref | ❌ | vincula a uma venda existente (opcional) |
| descricao | texto | ❌ | ex.: "comissão de renovação" |

### Regras de negócio
- Venda concluída no funil gera `vendas` + parcelas de `comissoes` conforme regra do produto (§7).
- **Comissão avulsa** cria linha em `comissoes` sem venda (ou vinculada), para renovações que caem soltas.
- Status da venda: `concluida | pendente | cancelada`. Cancelar estorna comissões projetadas.
- **Exportar Fechamento** é ação de saída de dados — não dispara sozinho; requer clique explícito.

### Dependências
Produtos (§7), Funil (§4). Alimenta Dashboard (§2), Desempenho (§15), Despesas/Resultado (§12).

### Modelo de dados sugerido
`vendas` — `id, tenant_id, lead_id, produto_id, vendedor_id, valor, forma_pagamento, tipo ('original'|'renovacao'), status, data_venda, criado_em`.
`comissoes` — `id, tenant_id, venda_id (nullable), beneficiario, valor, competencia (mês/ano), status ('projetada'|'a_receber'|'recebida'), data_prevista, data_recebimento, criado_em`.

### Integrações externas
Exportação (geração de arquivo). *(Sugestão: sem integração contábil no MVP.)*

### Priorização MoSCoW
| Item | Nível |
|---|---|
| Lista de vendas + filtros | **Must** |
| Geração de comissões a partir da venda | **Must** |
| Comissão avulsa | **Should** |
| Exportar fechamento | **Should** |
| Comissão dupla na visão financeira | **Could** (segue §7) |

### Riscos e decisões abertas
- Regras de estorno ao cancelar/reabrir venda (alinhar com §4).
- Competência das parcelas (regime de caixa vs. competência) — definir com o owner.

---

## 9. Renovações / Gestão de Carteira

### Objetivo de negócio
Gerir a carteira pós-venda e o pipeline de renovações, com métricas de saúde da base. **Aqui o "set and forget" do Fideliza reencontra o CRM de vendas.**

### User stories principais
- Como **corretor**, quero cadastrar um negócio avulso (apólice/contrato), para alimentar renovações mesmo sem passar pelo funil.
- Como **corretor**, quero ver quando cada contrato vence, para agir antes de perder o cliente.
- Como **gerente**, quero métricas de carteira (retenção, LTV), para saber a saúde do negócio recorrente.

### Telas e componentes
- **Pipeline de renovações** (por data de vencimento).
- **Modal "Cadastrar Negócio Avulso"** (2º formulário mais completo).
- **Painel de métricas de carteira** (TRC, LTV, NPS, CPR, TCC, RPC, TMR) + **Score Geral**.

### Campos e validações — Negócio Avulso

| Campo | Tipo | Obrig. | Regra |
|---|---|---|---|
| lead_id | ref | ❌ | associa a lead existente OU preenche do zero |
| nome_cliente | texto | ✅ | se sem lead |
| telefone / email / empresa | — | ❌ | contato |
| produto_id | ref | ✅ | bloqueia sem produto (atalho "Cadastrar Produto") |
| valor_negocio | moeda | ✅ | > 0 |
| forma_pagamento | seleção | ✅ | débito/boleto/pix/cartão/dinheiro/outro |
| data_inicio | data | ✅ | — |
| prazo | atalho/data | ✅ | 6m / 1a / 2a **ou** data de vencimento manual |
| observacoes | texto | ❌ | — |

### Regras de negócio
- Negócio avulso cria uma **apólice/contrato** (`apolices`) que alimenta o pipeline de renovação e as métricas.
- **Sem apólices, todas as métricas ficam zeradas** (comportamento visto no concorrente).
- Aproxima do vencimento → gera alerta/estágio "Pré-Renovação" (integra com Pós-Vendas §10 e Alertas).
- Métricas (definições a fechar com o owner — **glossário obrigatório**): TRC (retenção), LTV, NPS, CPR, TCC, RPC, TMR.

### Dependências
Produtos (§7), Leads (§3), Pós-Vendas (§10), Vendas (§8).

### Modelo de dados sugerido
`apolices` — `id, tenant_id, lead_id (nullable), cliente_nome, contato_json, produto_id, valor, forma_pagamento, data_inicio, data_vencimento, status ('vigente'|'em_renovacao'|'renovada'|'perdida'), criado_em`.
`carteira_metricas` (cache diário) — `id, tenant_id, competencia, trc, ltv, nps, cpr, tcc, rpc, tmr, score_geral`.

### Integrações externas
Nenhuma.

### Priorização MoSCoW
| Item | Nível |
|---|---|
| Cadastrar negócio avulso + apólices | **Should** |
| Pipeline de renovação por vencimento | **Should** |
| Alertas de pré-renovação | **Should** |
| Métricas de carteira (7 indicadores) | **Won't** (MVP) → **v2** |
| Score geral da carteira | **Won't** (MVP) → **v2** |

### Riscos e decisões abertas
- **As 7 siglas precisam de definição matemática** antes de codar. Recomendo **cortar do MVP** e trazer 2–3 métricas simples (taxa de renovação, receita recorrente) primeiro.

---

## 10. Pós-Vendas

### Objetivo de negócio
A **esteira automática por tempo** — o cliente "anda sozinho" pelas etapas após a venda (Boas-vindas D+1, Satisfação D+30, Expansão D+45, Pré-Renovação D-60, Renovação). **É aqui que o DNA "set and forget" do Fideliza vive** e diferencia do concorrente.

### User stories principais
- Como **corretor**, quero que o pós-venda aconteça sozinho, para reter cliente sem esforço contínuo.
- Como **corretor**, quero editar os templates por vertical, para falar a língua do meu cliente.
- Como **corretor**, quero personalização com o nome do cliente, para não parecer robô.

### Telas e componentes
- **Board da esteira** (colunas por estágio; movimento **automático por tempo**, sem drag manual).
- **Editor de templates** por **categoria/vertical** (Seguro, Saúde, Consórcio, Venda de Imóvel, Locação, Administração de Imóveis, Geral) e por **estágio** (Boas-vindas, Satisfação, Expansão, Pré-Renovação, Renovação, Aniversário).
- Botões **"Restaurar todos" / "Redefinir" / "Salvar templates"**.
- **"Fluxos"** — configuração de quando cada estágio dispara (regras de tempo).

### Campos e validações
Template: `categoria`, `estagio`, `conteudo` (com variável `[NOME]`), `ativo`. Conteúdo obrigatório; variáveis validadas contra whitelist (`[NOME]`, futuramente `[PRODUTO]`, `[VENCIMENTO]`).

### Regras de negócio
- Movimento é **por tempo decorrido desde a venda** (job diário), não manual.
- Cada estágio dispara mensagem via canal configurado (**WhatsApp Meta Cloud API** / e-mail Resend).
- **LGPD + Meta:** felicitação de aniversário só dispara com **consentimento explícito** (`aceita_felicitacao_aniversario = true`) — regra já existente no Fideliza, mantida.
- **Reaproveita a fundação atual do Fideliza:** score de completude (< 40% suspende disparos), cron idempotente (nunca duplica alerta), `historico_disparos`.

### Dependências
Vendas (§8) / Apólices (§9), Templates, Canais (§13). **Herda toda a Fase 2–3 do Fideliza atual** (cron + Resend + Meta Cloud API + templates).

### Modelo de dados sugerido
Reusa `alertas`, `templates`, `historico_disparos` (já modelados). Adicionar `pos_venda_esteira` — `id, tenant_id, venda_id/apolice_id, estagio_atual, proximo_disparo_em`.

### Integrações externas
Meta Cloud API (WhatsApp) · Resend (e-mail) · Claude API (opcional, redigir/variar mensagens).

### Priorização MoSCoW
| Item | Nível |
|---|---|
| Esteira automática por tempo | **Should** (é o diferencial — priorizar) |
| Editor de templates por vertical | **Should** |
| Disparo WhatsApp/e-mail com `[NOME]` | **Should** |
| Consentimento LGPD para aniversário | **Must** (quando houver disparo) |
| Editor visual de "Fluxos" | **Could** |

### Riscos e decisões abertas
- **Este módulo é o coração do Fideliza original.** Decisão-chave ([§19](#19-perguntas-para-o-owner)): num CRM de vendas amplo, o pós-venda continua sendo o carro-chefe ou vira mais um módulo? Recomendo mantê-lo como **diferencial de posicionamento**.

---

## 11. Gerador de Propostas + Simulador de Consórcio

### Objetivo de negócio
Gerar propostas profissionais rápido e, para consórcio, simular matematicamente as modalidades — reduzindo atrito entre interesse e fechamento.

### User stories principais
- Como **corretor**, quero gerar uma proposta a partir de um lead, para agilizar o envio.
- Como **corretor de consórcio**, quero simular sorteio/lance/amortização, para mostrar números ao cliente.

### Telas e componentes
- **Modal "Gerar proposta"** (Seguros/Saúde/Imobiliário) com abas **Lead Existente** (busca por nome/empresa/telefone) e **Novo Lead** → "Continuar" → tela de personalização → **PDF**.
- **Simulador de Consórcio:** escolhe tipo (Padrão: Sorteio/Lance Fixo/Amortização; Investimento: Rentabilidade/Auto-cálculo/ROI; Estruturada: Giro decrescente/Amortização Especial/Empresas) → dados financeiros → **PDF**.

### Campos e validações
Proposta: lead (existente/novo), produto, valores, condições. Simulador: valor da carta, prazo, taxa adm, lance, índice de reajuste — validações numéricas por modalidade.

### Regras de negócio
- Cada tipo de consórcio usa **fórmula financeira diferente**; o simulador seleciona a fórmula pela modalidade.
- Gerar proposta cria/atualiza o lead e registra o envio (timeline).
- PDF gerado server-side com identidade visual do tenant.

### Dependências
Leads (§3), Produtos (§7).

### Modelo de dados sugerido
`propostas` — `id, tenant_id, lead_id, produto_id, tipo, dados_json, pdf_url, status, criado_em`.

### Integrações externas
Geração de PDF *(sugestão: lib server-side)*. Sem integração externa obrigatória.

### Priorização MoSCoW
| Item | Nível |
|---|---|
| Gerar proposta simples (PDF) a partir de lead | **Could** |
| Simulador de consórcio (modalidades) | **Won't** (MVP) → **v2** |

### Riscos e decisões abertas
- **Matemática do consórcio é complexa e específica** — alto custo/risco. Recomendo **v2** e só se consórcio for vertical prioritário no launch.

---

## 12. Despesas

### Objetivo de negócio
Fechar o ciclo financeiro: registrar custos para calcular **resultado líquido** e **custo sobre receita**.

### User stories principais
- Como **corretor**, quero lançar despesas por categoria, para saber meu lucro real.
- Como **corretor**, quero marcar despesa recorrente, para não relançar todo mês.

### Telas e componentes
- **Lista de despesas** + **modal "Nova Despesa"**.
- Indicadores no dashboard financeiro: **Resultado Líquido**, **Custo sobre Receita**.

### Campos e validações

| Campo | Tipo | Obrig. | Regra |
|---|---|---|---|
| data | data | ✅ | — |
| valor | moeda | ✅ | > 0 |
| categoria | pastilha | ✅ | Marketing, Transporte, Alimentação, Software, Escritório, Telefone/Internet, Capacitação, Impostos, Comissões Pagas, Outros |
| descricao | texto | ❌ | — |
| recorrente | bool | ❌ | se true, replica mensalmente |

### Regras de negócio
- **Recorrente** gera lançamentos automáticos mensais (job) até ser desativada.
- Resultado Líquido = receita (vendas/comissões) − despesas do período.

### Dependências
Vendas/Comissões (§8) para o resultado líquido.

### Modelo de dados sugerido
`despesas` — `id, tenant_id, user_id, data, valor, categoria, descricao, recorrente, recorrencia_pai_id, criado_em`.

### Integrações externas
Nenhuma.

### Priorização MoSCoW
| Item | Nível |
|---|---|
| Nova despesa + categorias | **Could** |
| Recorrência automática | **Could** |
| Resultado líquido / custo sobre receita | **Could** |

### Riscos e decisões abertas
- Baixa prioridade para o MVP (corretor autônomo raramente usa CRM para contabilidade). Confirmar apetite.

---

## 13. Canais de Captura

### Objetivo de negócio
Automatizar a entrada de leads por múltiplos canais, com métricas por canal para decidir onde investir marketing.

### User stories principais
- Como **corretor**, quero um WhatsApp com IA que qualifica e cria leads 24h, para não perder contato fora do horário.
- Como **corretor**, quero uma landing page própria para anúncios, para capturar direto no funil.
- Como **corretor**, quero extrair leads do Google Maps, para prospectar ativamente.

### Telas e componentes
- **Visão de canais** com 4 origens: **WhatsApp com IA**, **Landing Page**, **Extrator Google Maps**, **Cadastro Manual**.
- Comparativo de métricas por canal (leads, %, ativos, vendas, conversão, receita) + **Insights automáticos** (ex.: canal inativo).
- **WhatsApp:** "Criar Instância" → provisiona número/webhook.
- **Landing Page:** "Criar Landing Page" → escolha de URL `fideliza.app/sua-url` (minúsculas, números, hífen) → template.
- **Extrator:** card de download da extensão de navegador.

### Campos e validações
Landing: slug único (regex `^[a-z0-9-]+$`), template. WhatsApp: confirmação explícita antes de provisionar (efeito colateral real).

### Regras de negócio
- **⚠️ WhatsApp = Meta Cloud API oficial da Meta — NUNCA Evolution/Z-API** (decisão cravada do owner: risco de banimento em massa e violação de termos). O relatório do concorrente usa Evolution/Z-API; **aqui não replicamos isso.**
- Um **número central da plataforma** atende todos os tenants (arquitetura Fideliza), roteando por tenant — não um número por corretor com API não-oficial.
- Leads entram com origem automática: `whatsapp`, `landing`, `extrator`, `manual`.
- **Agente de IA** (RAG obrigatório, teto de consultas por plano) segue a arquitetura já definida do Fideliza (Node.js customizado, não n8n).
- "Criar Instância" e "Publicar Landing" são **ações com efeito externo** — exigem confirmação explícita.

### Dependências
Leads (§3), Agente/WhatsApp (fundação Fideliza Fases 3/5).

### Modelo de dados sugerido
`canais` — `id, tenant_id, tipo, config_json, ativo, criado_em`.
`landing_pages` — `id, tenant_id, slug, template, publicada, criado_em`.
Reusa `sessoes_whatsapp` (já modelado).

### Integrações externas
**Meta Cloud API** (WhatsApp oficial) · webhook próprio · extensão de navegador (Google Maps → API própria) · Claude API (agente).

### Priorização MoSCoW
| Item | Nível |
|---|---|
| Cadastro manual (é o §3) | **Must** |
| WhatsApp com IA (Meta Cloud API) | **Should** (herda Fases 3/5 do Fideliza) |
| Landing page própria | **Could** |
| Extrator Google Maps (extensão) | **Won't** (MVP) → **v2** |
| Métricas por canal + insights | **Could** |

### Riscos e decisões abertas
- **Conflito resolvido:** manter Meta Cloud API. Registrar que a paridade com o concorrente (Evolution/Z-API) **não será buscada** por decisão de risco.
- Extensão de navegador é produto à parte (build/manutenção próprios) — avaliar ROI.

---

## 14. Agenda

### Objetivo de negócio
Centralizar compromissos individuais e de equipe, conectando follow-ups do funil a horários concretos.

### User stories principais
- Como **corretor**, quero agendar compromissos ligados a um lead, para não esquecer follow-ups.
- Como **secretária**, quero ver e organizar a agenda da equipe, para dar suporte.

### Telas e componentes
- **Calendário** (dia/semana/mês) com abas "Minha agenda" / "Equipe".
- **Modal "Novo Compromisso"** (o mesmo acionado do Dashboard).

### Campos e validações

| Campo | Tipo | Obrig. | Regra |
|---|---|---|---|
| titulo | texto | ✅ | — |
| data_hora | datetime | ✅ | futura (ou permite passada?) |
| lead_id | ref | ❌ | vincula a lead |
| responsavel_id | ref users | ✅ | default = logado |
| tipo | seleção | ❌ | ligação/reunião/visita/outro |
| notas | texto | ❌ | — |

### Regras de negócio
- Compromisso vinculado a lead conta como "compromisso agendado" no score da Central de Prioridades (§5).
- Secretária tem acesso de **leitura+escrita da agenda**, sem acesso a valores.

### Dependências
Leads (§3), Usuários (§1). Alimenta Dashboard (§2) e Central de Prioridades (§5).

### Modelo de dados sugerido
`compromissos` — `id, tenant_id, responsavel_id, lead_id (nullable), titulo, data_hora, tipo, notas, status, criado_em`.

### Integrações externas
*(Sugestão v2: sync Google Calendar.)*

### Priorização MoSCoW
| Item | Nível |
|---|---|
| Novo compromisso + calendário | **Should** |
| Aba equipe | **Should** |
| Vínculo com lead | **Should** |
| Sync Google Calendar | **Won't** (MVP) |

### Riscos e decisões abertas
- Notificações/lembretes de compromisso (push/WhatsApp) — definir se entram já.

---

## 15. Desempenho

### Objetivo de negócio
Comparar vendedores e identificar concentração de faturamento (dependência de poucas pessoas).

### User stories principais
- Como **gerente**, quero comparar vendedores lado a lado, para gerir o time.
- Como **gerente**, quero saber quanto do faturamento vem dos top 3, para medir risco de concentração.

### Telas e componentes
- **Comparativo de vendedores** (vendas, ticket médio, conversão) com destaques automáticos ("Melhor Vendedor", "Maior Ticket").
- **Indicador de Concentração** (% do faturamento vindo dos 3 melhores).

### Campos e validações
Sem formulário; seletores de período/escopo.

### Regras de negócio
- Só faz sentido para tenant com **múltiplos vendedores**. Para autônomo, ocultar.
- Concentração = Σ(top 3) ÷ total.

### Dependências
Vendas (§8), Usuários (§1).

### Modelo de dados sugerido
Sem tabela nova; agregações sobre `vendas`.

### Integrações externas
Nenhuma.

### Priorização MoSCoW
| Item | Nível |
|---|---|
| Comparativo de vendedores | **Could** |
| Indicador de concentração | **Could** |

### Riscos e decisões abertas
- Depende de o MVP atender corretoras com equipe (ver [§19](#19-perguntas-para-o-owner)). Se o launch for só autônomos, **cortar**.

---

## 16. Assinatura e billing

### Objetivo de negócio
Monetizar o SaaS. **Aqui há conflito de modelo a decidir** (ver [§19](#19-perguntas-para-o-owner)).

### User stories principais
- Como **corretor**, quero assinar e pagar por cartão ou Pix, para começar a usar.
- Como **admin de corretora**, quero adicionar assentos conforme o time cresce, para escalar.

### Dois modelos sobre a mesa

| Modelo | Descrição | Origem |
|---|---|---|
| **A — Fideliza atual** | Implementação (R$497–997 única) + mensalidade (Essencial R$97 / Profissional R$197) | `INSTRUCOES-PROJETO.md` |
| **B — Concorrente** | Per-seat R$59/usuário/mês, mensal ou anual (−20%), planos = faixas de qtd (Individual/Time/Agência) | Relatório crm-corretor.top |

> **Recomendação:** para autônomo (público-alvo primário), o modelo A com Essencial/Profissional casa melhor com "features por plano" (ex.: churn score, agente WhatsApp só no Profissional). Se o alvo virar **corretoras com equipe**, o per-seat (B) faz mais sentido. **Decisão do owner necessária antes de codar billing.**

### Telas e componentes
- **Tela de planos/assinatura**, **Gerenciar plano**, **Trocar plano**, checkout (cartão/Pix), status de trial.

### Campos e validações
Trial (dias), método de pagamento, plano selecionado. Validações do provedor de pagamento.

### Regras de negócio
- Trial ativo libera o produto; ao expirar, bloqueio gradual (leitura mantida, escrita limitada — a definir).
- Teto de consultas do agente por plano (arquitetura Fideliza: Essencial 50/mês, Profissional 200/mês).
- **Pix + cartão** via Stripe (Stripe já é a stack definida; validar suporte a Pix ou provedor alternativo).

### Dependências
Autenticação/tenant (§1).

### Modelo de dados sugerido
`assinaturas` — `id, tenant_id, plano, ciclo ('mensal'|'anual'), assentos, status, trial_fim, provider_ref, criado_em`.

### Integrações externas
**Stripe** (cartão; Pix a validar) · webhooks de pagamento.

### Priorização MoSCoW
| Item | Nível |
|---|---|
| Trial + bloqueio pós-trial | **Must** (para vender) |
| Checkout cartão | **Must** |
| Pix | **Should** |
| Per-seat / faixas de assentos | **Could** (segue decisão de modelo) |
| Desconto anual | **Could** |

### Riscos e decisões abertas
- **Modelo de precificação (A vs. B)** — decisão do owner, bloqueia o design do billing.
- Pix no Stripe: confirmar disponibilidade/provedor.

---

## 17. Configurações e ajuda

### Objetivo de negócio
Reduzir suporte e dar autonomia: preferências do usuário e documentação viva.

### User stories principais
- Como **usuário**, quero escolher a tela inicial pós-login, para cair onde trabalho mais.
- Como **usuário novo**, quero tutoriais e FAQ, para me virar sozinho.

### Telas e componentes
- **Configurações:** tela de redirecionamento pós-login (Dashboard/Agenda/Funil — salvo em `localStorage`), **toggle de dark mode** (pós-login, `data-theme="dark"`), preferências de notificação.
- **Central de Ajuda:** tutoriais em vídeo, atalhos por módulo, FAQ, "Primeiros passos" (roteiro), contato de suporte via WhatsApp.

### Campos e validações
Preferências simples (enum/bool). Sem validação crítica.

### Regras de negócio
- Redirecionamento pós-login e dark mode são **preferências locais** (`localStorage`), não do servidor.
- **Regra de identidade:** login/cadastro **sempre claros**; dark mode só existe **pós-login**.

### Dependências
Transversal.

### Modelo de dados sugerido
Preferências em `localStorage`; opcional `user_preferences` no banco se precisar cross-device.

### Integrações externas
Nenhuma (suporte via WhatsApp = link).

### Priorização MoSCoW
| Item | Nível |
|---|---|
| Redirecionamento pós-login + dark mode | **Should** |
| Central de Ajuda (FAQ + primeiros passos) | **Should** |
| Tutoriais em vídeo | **Could** |

### Riscos e decisões abertas
- Preferências só locais quebram entre dispositivos — decidir se vão pro banco.

---

## 18. Roadmap sugerido

> Fases de **produto** (independentes da numeração de fases técnicas do Fideliza atual). Prioriza o fluxo essencial do corretor: **cadastrar lead → mover no funil → registrar venda → ver comissão**, com o **pós-venda automático** como diferencial.

### MVP (lançável — foco: funil de vendas + comissão clara)
- **§1** Autenticação, papéis, isolamento `tenant_id` (self-signup corretor).
- **§3** Leads (campos obrigatórios + origem + interesse).
- **§4** Funil Kanban (6 estágios, venda nasce do card, histórico de estágio).
- **§7** Produtos + comissão **Fixa** (schema de comissão dupla já pronto).
- **§8** Vendas + geração de comissão.
- **§2** Dashboard (KPIs + listas).
- **§16** Trial + checkout (mínimo para vender).
- **§17** Configurações básicas + ajuda.

### v1.1 (aprofunda operação e diferencial)
- **§1** Equipe (vendedor/líder/gerente) + secretária.
- **§5** Central de Prioridades (score + próxima ação).
- **§10** Pós-Vendas automático (esteira + templates) — **carro-chefe Fideliza**.
- **§14** Agenda.
- **§7** UI da comissão dupla (aba corretora).
- **§8** Comissão avulsa + exportar fechamento.
- **§13** WhatsApp com IA (Meta Cloud API) + landing page.

### v2 (BI, carteira e verticais complexas)
- **§6** Inteligência do Funil (forecast, gargalos, mapa de calor, velocidade).
- **§9** Gestão de Carteira completa (métricas TRC/LTV/NPS/…).
- **§11** Gerador de Propostas + Simulador de Consórcio.
- **§15** Desempenho (comparativo, concentração).
- **§12** Despesas + resultado líquido.
- **§13** Extrator Google Maps (extensão).
- **§7** Modelos Bônus+Vitalício / Diluída.

---

## 19. Perguntas para o owner

> Decisões que **bloqueiam** implementação além do MVP. Ordenadas por impacto.

1. **Pivot de escopo — a mais importante.** O Fideliza documentado é **pós-venda puro, só saúde, "não é plataforma de vendas"**. Este PRD é um **CRM de vendas multi-vertical**. Confirma que você quer **pivotar/expandir** para CRM de vendas completo? Ou o objetivo é **anexar um módulo de vendas** ao pós-venda existente, mantendo o pós-venda como núcleo? *(Muda tudo: posicionamento, arquitetura, roadmap.)*
2. **Público do launch:** corretor **autônomo** (1 usuário/tenant, como hoje) ou já **corretoras com equipe** (multi-usuário, hierarquia)? Isso decide se §1-equipe, §15 e o per-seat entram no MVP.
3. **Verticais no launch:** liberar os 4 (consórcio/seguro/saúde/imobiliário) ou começar por **saúde** (onde está a beta = sua mãe) e expandir? *(Recomendo saúde primeiro — valida com dado real.)*
4. **Precificação (§16):** modelo **A** (implementação + R$97/197) ou **B** (per-seat R$59)? Bloqueia o design do billing.
5. **Comissão dupla no MVP (§7):** só no **schema** (recomendado) ou também na **UI** desde o MVP?
6. **Pós-venda como diferencial (§10):** mantemos a esteira "set and forget" + score de completude como **carro-chefe de posicionamento** (o que te separa do crm-corretor.top), certo?
7. **WhatsApp (§13):** confirmo que mantemos **Meta Cloud API oficial** e **não** buscamos paridade com o Evolution/Z-API do concorrente, mesmo que isso adie/limite features de automação de captura?
8. **Métricas de carteira (§9)** e **simulador de consórcio (§11):** confirma que ficam para **v2**? Ambos exigem definição matemática que ainda não temos.
9. **Score da Central de Prioridades (§5):** ok validar a fórmula sugerida com sua mãe antes de cravar?

---

## Apêndice A — Modelo de dados consolidado

> Nível conceitual. Todas as tabelas de negócio têm `tenant_id` e **toda query filtra por ele** (exceto o painel interno cross-tenant já existente). Reaproveita o schema atual do Fideliza onde possível (`tenants`, `users`, `clientes`, `alertas`, `templates`, `historico_disparos`, `sessoes_whatsapp`).

| Tabela | Chave / relacionamento | Papel |
|---|---|---|
| `tenants` *(existe)* | id | corretora/corretor |
| `users` *(existe, +`cargo`,`lider_id`)* | tenant_id | login + hierarquia |
| `leads` *(nova)* | tenant_id, responsavel_id | pipeline de vendas |
| `lead_interacoes` *(nova)* | lead_id | histórico de contato |
| `lead_estagio_historico` *(nova)* | lead_id | base do BI |
| `produtos` *(nova)* | tenant_id | catálogo |
| `produto_comissao_regras` *(nova)* | produto_id | comissão dupla/estruturas |
| `vendas` *(nova)* | lead_id, produto_id | faturamento |
| `comissoes` *(nova)* | venda_id (nullable) | recebíveis (corretor/corretora) |
| `apolices` *(nova)* | lead_id (nullable), produto_id | carteira/renovação |
| `carteira_metricas` *(nova, v2)* | tenant_id | cache de indicadores |
| `compromissos` *(nova)* | responsavel_id, lead_id | agenda |
| `despesas` *(nova)* | tenant_id | custos |
| `canais` / `landing_pages` *(novas)* | tenant_id | captura |
| `propostas` *(nova, v2)* | lead_id, produto_id | propostas/simulações |
| `assinaturas` *(nova)* | tenant_id | billing |
| `alertas` / `templates` / `historico_disparos` *(existem)* | tenant_id, cliente_id | pós-venda automático |
| `clientes` *(existe)* | tenant_id | base pós-venda (saúde) — reconciliar com `leads`/`apolices` |

> **Ponto de arquitetura a decidir:** o Fideliza atual tem `clientes` (pós-venda). O CRM de vendas introduz `leads`/`apolices`. Definir se **lead convertido vira cliente** (mesma entidade em estágios diferentes) ou se são tabelas separadas com FK. **Recomendo:** `leads` (pré-venda) → ao concluir venda, cria/atualiza `clientes` (pós-venda), mantendo o pós-venda existente intacto.

---

## Apêndice B — Listas estratégicas (origem e interesse)

> Estes campos alimentam o BI (§6). Detalhados porque a **granularidade do preenchimento = qualidade da análise** de "qual canal converte".

**Interesse (produto/vertical) — obrigatório no lead:**
`Consórcio · Seguro · Plano de Saúde · Imóvel`

**Origem específica — obrigatório no lead (campo com busca + "Outros"):**

| Grupo | Opções |
|---|---|
| Mídia paga | Instagram · Facebook/Meta Ads · Google Ads · YouTube · TikTok · LinkedIn |
| Orgânico/direto | WhatsApp · E-mail Marketing · Site/Landing Page |
| Indicações | Indicação de Cliente · Indicação de Parceiro · Indicação de Corretor |
| Ativo/presencial | Ligação Ativa · Abordagem Presencial · Evento/Feira · Panfleto |
| Parcerias | Empresa Parceira · RH/Benefícios · Sindicato/Associação |
| Base própria | Carteira Antiga · Reativação de Lead |
| Automáticas (preenchidas pelo sistema) | `whatsapp` · `landing` · `extrator` · `manual` |

**Categorias de despesa (§12):**
`Marketing · Transporte · Alimentação · Software/Assinaturas · Escritório · Telefone/Internet · Capacitação · Impostos/Taxas · Comissões Pagas · Outros`

**Formas de pagamento (§4/§8/§9):**
`Débito em conta · Boleto · Pix · Cartão de Crédito · Dinheiro · Outro`

---

*Fim do PRD v1. Próximo passo sugerido: você responder as [Perguntas para o owner (§19)](#19-perguntas-para-o-owner) — sobretudo a #1 (pivot de escopo) — e eu converto o MVP em backlog com migrations e telas.*
