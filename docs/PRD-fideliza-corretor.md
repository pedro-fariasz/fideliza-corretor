# PRD MVP — fideliza-corretor
**Versão:** 1.0 (MVP)
**Owner:** Pedro Farias (`pedro-fariasz/fideliza-corretor`)
**Prazo alvo:** 3-4 meses solo com Claude Code
**Status:** Draft para implementação

---

## Sumário
1. [Visão e proposta de valor](#1-visão-e-proposta-de-valor)
2. [Escopo do MVP — o que entra e o que fica de fora](#2-escopo-do-mvp)
3. [Persona-alvo do MVP](#3-persona-alvo-do-mvp)
4. [Stack sugerida](#4-stack-sugerida)
5. [Modelo de dados (conceitual)](#5-modelo-de-dados)
6. [Módulos](#6-módulos)
   - 6.1 [Autenticação e conta](#61-autenticação-e-conta)
   - 6.2 [Dashboard](#62-dashboard)
   - 6.3 [Leads](#63-leads)
   - 6.4 [Funil Kanban](#64-funil-kanban)
   - 6.5 [Produtos e regras de comissão](#65-produtos-e-regras-de-comissão)
   - 6.6 [Vendas e comissões](#66-vendas-e-comissões)
   - 6.7 [Agenda](#67-agenda)
   - 6.8 [Assinatura simples](#68-assinatura-simples)
7. [Métricas de sucesso do MVP](#7-métricas-de-sucesso-do-mvp)
8. [Roadmap: MVP → v1.1 → v2](#8-roadmap)
9. [Perguntas abertas pro Pedro](#9-perguntas-abertas)

---

## 1. Visão e proposta de valor
**O que é:** SaaS de CRM para corretores brasileiros gerenciarem leads, funil de vendas e comissões, começando por **uma única vertical**.

**Por que existe:** corretores hoje usam WhatsApp + planilha + memória. Perdem lead por não ter follow-up, perdem comissão por não ter controle, e não sabem qual canal de captação realmente converte.

**Promessa do MVP em uma frase:** *"Do primeiro contato até a comissão recebida, num só lugar, em menos de 5 minutos de cadastro."*

**Diferencial estratégico (mesmo no MVP):** cálculo de comissão que faz sentido para o mercado brasileiro (parcelada, recorrente, com data de início do pagamento configurável). É a dor #1 do corretor autônomo. Somado a isso, o **cadastro sem digitação via PDF da proposta** — o corretor sobe o documento que já tem em mãos e o sistema preenche o lead sozinho.

---

## 2. Escopo do MVP

### O que ENTRA
- Cadastro e login (Corretor + Admin da conta)
- Cadastro de leads manual, com origem específica e produto de interesse
- **Cadastro de lead via upload do PDF da proposta** — extração automática dos dados do cliente por IA, com confirmação do corretor antes de salvar (ver [6.3.1](#631-cadastro-via-pdf-da-proposta))
- Funil Kanban com 6 estágios e drag-and-drop
- Cadastro de produtos com regra de comissão (fixa % + tipo de recorrência)
- Registro de venda a partir do funil (mover card = criar venda)
- Cálculo automático de comissão projetada
- Dashboard com KPIs básicos (leads, vendas, comissão prevista/recebida, funil resumido)
- Agenda simples de compromissos (evento único, sem recorrência)
- Assinatura mensal via Asaas (cartão + Pix)

### O que FICA DE FORA (v1.1 ou v2)
- Secretária como papel separado
- Hierarquia (Vendedor/Líder/Gerente)
- Comissão dupla (Corretor + Corretora) — modelar no banco, esconder na UI
- BI avançado (forecast, health score, mapa de calor, velocidade de resposta)
- Central de Prioridades com score 0-100
- Renovações e métricas de carteira (TRC, LTV, NPS, CPR, TCC, RPC, TMR)
- Pós-Vendas (esteira automática, templates)
- Simulador de Consórcio
- Gerador de Propostas em PDF
- WhatsApp com IA
- Landing Page pública personalizada
- Extrator Google Maps (extensão de navegador)
- Despesas e resultado líquido
- Desempenho comparativo entre vendedores

### Justificativa dos cortes
Cada item removido gera 2-6 semanas de trabalho a mais. O MVP precisa ser lançável em 3-4 meses solo. Renovações e comissão dupla são o "must" que vem primeiro em v1.1, porque destravam o cliente que fica.

---

## 3. Persona-alvo do MVP
**Corretor autônomo brasileiro, 28-50 anos, 1-3 anos de mercado, uma vertical principal.**
- Trabalha do celular 60% do tempo, do desktop 40%.
- Já tem WhatsApp Business e usa planilha do Google Sheets pra controlar comissão.
- Não sabe (ou não confia) quanto vai receber mês que vem.
- Já perdeu venda por não ter feito follow-up no tempo certo.
- Aceita pagar até ~R$60/mês por uma ferramenta que resolva os dois pontos acima **de verdade**.

**Não é persona do MVP:** escritório com 10+ corretores, gerente comercial, seguradora grande. Isso vem em v2.

**Decisão pendente:** qual vertical liberar no lançamento. Recomendo **consórcio** ou **seguro auto/vida**, porque têm ciclo de comissão bem definido e você (Pedro) já conhece o mercado do MOVA-SE.

---

## 4. Stack sugerida
> Sugestões. Você decide.

| Camada | Sugestão | Alternativa | Motivo |
|---|---|---|---|
| Framework | Next.js 15 (App Router) | Laravel 11 + Livewire | Full-stack num único repo, deploy fácil, Claude Code roda bem |
| Banco | PostgreSQL (Neon ou Supabase) | MySQL no VPS | Gerenciado no início evita dor de cabeça |
| ORM | Prisma | Drizzle | Curva de aprendizado suave, migrations fáceis |
| Auth | Auth.js (NextAuth) ou Clerk | — | Clerk é R$0 até 10k MAU, poupa tempo |
| UI | shadcn/ui + Tailwind | Mantine | Já é padrão do ecossistema, Claude Code entende bem |
| Pagamento | Asaas | Pagar.me | API BR-first, aceita Pix nativo |
| Email | Resend | AWS SES | Setup em 10 min |
| **Extração de PDF (IA)** | **Claude API (Anthropic)** | AWS Textract + regex | Lê a proposta e devolve os campos estruturados; já era da fundação do projeto |
| **Storage de arquivos** | **Supabase Storage / Cloudflare R2** | S3 | Guardar o PDF da proposta vinculado ao lead |
| Hosting | Railway ou Vercel + Neon | VPS Hetzner + Coolify | Deploy contínuo, sem sysadmin |
| Monitoramento | Sentry (free tier) | — | Erro em produção sem monitoramento é suicídio |

**Custo dessa stack no início (0-20 clientes):** ~R$ 250-500/mês.
**Custo marginal da extração de PDF:** fração de centavo a poucos centavos por proposta processada (Claude API, cobrado por token) — desprezível no MVP, mas monitorar quando escalar.

---

## 5. Modelo de dados
Tabelas principais e relacionamentos. Nível conceitual — os campos exatos vão em cada módulo abaixo.

```
users (id, email, senha_hash, nome, telefone, papel, conta_id, criado_em)
contas (id, nome_empresa, plano, status_assinatura, trial_termina_em)
leads (id, conta_id, dono_id, nome, telefone, email, tipo_pessoa, empresa,
       interesse, origem_especifica, estagio, probabilidade, observacoes,
       origem_cadastro, criado_em)
produtos (id, conta_id, nome, categoria, ativo, tipo_comissao, percentual,
          parcelas_limite, inicio_pagamento, dia_pagamento, criado_em)
vendas (id, conta_id, lead_id, produto_id, vendedor_id, valor,
        forma_pagamento, data_venda, status, criado_em)
comissoes (id, venda_id, tipo, percentual, valor_parcela, num_parcela,
           data_prevista, data_recebida, status)
compromissos (id, conta_id, usuario_id, lead_id, titulo, descricao,
              data_inicio, data_fim, criado_em)
interacoes (id, lead_id, usuario_id, tipo, descricao, criado_em)
arquivos (id, conta_id, lead_id, tipo, url, nome_original,
          status_extracao, dados_extraidos_json, criado_em)
```

**Decisões chave já embutidas:**
- `conta_id` em tudo → multi-tenant desde o dia 1. Não retrofitar isso depois. (No schema Supabase atual isso já existe como `tenant_id` — se mantiver Supabase, reusar essa fundação em vez de recriar.)
- `comissoes` é tabela separada de `vendas` → uma venda gera N parcelas de comissão, cada uma com sua data prevista. Isso destrava relatório de "comissão a receber por mês" sem gambiarra.
- `interacoes` já existe no MVP mesmo sem tela dedicada — é onde o funil escreve automaticamente ("Movido de Qualificado para Proposta em DD/MM").
- `arquivos` guarda o PDF da proposta e o resultado bruto da extração (`dados_extraidos_json`), vinculado ao lead. `leads.origem_cadastro` ∈ `manual | pdf` — permite medir depois quantos leads entram por cada caminho.

---

## 6. Módulos

### 6.1 Autenticação e conta
**Objetivo:** permitir que o corretor se cadastre, entre em trial de 14 dias e comece a usar em menos de 2 minutos.

**User stories:**
- Como corretor, quero me cadastrar com email e senha e cair já dentro do sistema em trial.
- Como corretor, quero recuperar senha por email.
- Como admin da conta, quero convidar até 2 corretores adicionais no MVP (limite técnico para simplificar).

**Telas:** signup, login, esqueci-senha, aceite-de-convite.

**Campos (signup):**

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| Nome completo | texto | sim | mín. 3 caracteres |
| Email | email | sim | único no sistema |
| Senha | senha | sim | mín. 8 caracteres, 1 número |
| Nome da empresa | texto | sim | vira `contas.nome_empresa` |
| WhatsApp | telefone | não | máscara BR |

**Regras:**
- Signup cria `contas` + `users` (papel `admin`) numa transação.
- Trial de 14 dias começa no signup, `trial_termina_em` = hoje + 14.
- Após trial sem assinatura, conta entra em `status_assinatura = 'suspensa'` e usuário vê tela de bloqueio com CTA para assinar.

**MoSCoW:** Must — signup, login, trial. Should — recuperação de senha. Could — convite de corretor. Won't (MVP) — SSO, 2FA.

---

### 6.2 Dashboard
**Objetivo:** primeira tela após login, dá visão de 5 segundos do estado do negócio.

**Componentes:**
1. **4 KPI cards** (mês corrente):
   - Leads novos (contagem de `leads` criados no mês)
   - Vendas concluídas (contagem + soma de `vendas.valor`)
   - Comissão prevista (soma de `comissoes.valor_parcela` com data prevista no mês)
   - Comissão recebida (mesmo, mas filtro por `data_recebida` preenchida)
2. **Filtro de período** (Este mês / 30 dias / Este ano / Custom)
3. **Funil resumido** — barras horizontais com contagem por estágio, botão "Abrir funil".
4. **Próximos compromissos** — próximos 5, com botão "Ver agenda".
5. **Vendas recentes** — últimas 5, com link para tela de vendas.

**Regras:**
- Todos os cálculos rodam server-side, cache de 60 segundos por conta.
- Se a conta não tem produto cadastrado, mostrar banner: "Cadastre seu primeiro produto para começar a registrar vendas".

**MoSCoW:** Must — 4 KPIs, funil resumido. Should — compromissos e vendas recentes. Won't — gráfico de tendência mensal (v1.1).

---

### 6.3 Leads
**Objetivo:** ponto de entrada de qualquer oportunidade. Cadastro rápido, dados suficientes pra alimentar BI depois.

**Telas:**
- Lista de leads (tabela com filtros)
- Modal "Novo Lead" (manual)
- **"Importar proposta (PDF)"** — fluxo de extração (ver 6.3.1)
- Detalhe do lead (aba dados + aba histórico de interações)

**Campos (Novo Lead):**

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| Tipo | radio PF/PJ | sim | default PF |
| Nome completo | texto | sim | mín. 3 |
| Empresa | texto | não | aparece só se PJ |
| Telefone | telefone | sim | máscara BR, único por conta |
| Email | email | não | validar formato se preenchido |
| Interesse | select | sim | opções fixas conforme a vertical escolhida no signup |
| Origem específica | select | sim | lista longa (ver abaixo) |
| Estágio inicial | select | sim | default "Prospectos" |
| Observações | textarea | não | livre |

**Lista de origem específica (fixa no MVP):**
Instagram, Facebook/Meta Ads, Google Ads, YouTube, TikTok, LinkedIn, WhatsApp, E-mail Marketing, Site/Landing Page, Indicação de Cliente, Indicação de Parceiro, Indicação de Corretor, Ligação Ativa, Abordagem Presencial, Evento/Feira, Panfleto, Empresa Parceira, RH/Benefícios, Sindicato/Associação, Carteira Antiga, Reativação de Lead.

> Quando o lead entra pela importação de PDF, a origem é pré-marcada como **"Proposta (PDF)"** (novo item da lista), editável pelo corretor.

**Regras:**
- Telefone único por conta — se já existir, mostrar aviso "Já existe lead com esse telefone: [link]".
- Ao criar lead, gera interação automática: "Lead cadastrado por [usuário]" (ou "Lead importado de proposta PDF por [usuário]").
- Aba histórico mostra timeline de interações + movimentações no funil + compromissos.

**Filtros da lista:** Meus leads / Todos, estágio, origem específica, período de criação, busca por nome/telefone.

**MoSCoW:** Must — cadastro manual e lista. Should — importação por PDF (6.3.1), detalhe com histórico. Could — importação CSV. Won't — enriquecimento automático de dados (v2).

---

#### 6.3.1 Cadastro via PDF da proposta
**Objetivo:** eliminar a digitação. O corretor já sai da venda com a proposta em PDF (da operadora/seguradora/administradora); ele sobe esse arquivo e o sistema cria o lead com os dados já preenchidos. É o caminho "menos de 5 minutos" da promessa do produto.

**User stories:**
- Como corretor, quero subir o PDF da proposta que já tenho e ter o cliente cadastrado sem redigitar nada.
- Como corretor, quero revisar e corrigir o que a IA leu antes de salvar, pra não entrar dado errado.
- Como corretor, quero que o PDF fique anexado ao cliente, pra consultar depois.

**Fluxo (telas):**
1. Botão **"Importar proposta (PDF)"** na lista de leads e dentro do funil.
2. **Upload** (arrastar ou selecionar; aceita PDF, até ~10 MB). Salva em storage e cria registro em `arquivos` com `status_extracao = 'processando'`.
3. **Processando…** — a extração roda **assíncrona** (não trava a tela). O corretor pode continuar usando o sistema; recebe aviso quando terminar.
4. **Tela de confirmação** — formulário do lead **pré-preenchido** com os campos que a IA extraiu, cada campo lido destacado (ex.: borda azul + ícone "preenchido pela IA"). Campos não encontrados ficam vazios pro corretor completar.
5. **Salvar** — cria o `lead` com `origem_cadastro = 'pdf'`, vincula o `arquivo`, grava a interação automática.

**Campos que a IA tenta extrair (best-effort):**

| Campo | Observação |
|---|---|
| Nome do cliente / titular | quando PJ, também razão social / empresa |
| Telefone / WhatsApp | normalizado pra máscara BR |
| Email | se constar na proposta |
| CPF/CNPJ | valida dígito; define tipo PF/PJ |
| Produto / plano / categoria | tenta casar com um `produto` cadastrado da conta |
| Operadora / administradora / seguradora | vira observação ou origem |
| Valor do negócio / prêmio / mensalidade | número, pra pré-preencher a venda depois |

**Regras de negócio (críticas):**
- **A IA nunca cria o lead sozinha.** Sempre passa pela tela de confirmação do corretor. Extração é sugestão, não verdade.
- **Extração assíncrona** — o upload responde na hora; o webhook/worker chama a Claude API em background e atualiza `arquivos.status_extracao` (`processando → concluida | falhou`).
- **Falha de leitura** (PDF escaneado ruim, layout desconhecido): cai no cadastro manual com o PDF já anexado e uma mensagem "Não consegui ler a proposta — preencha os campos e o arquivo fica salvo".
- **Isolamento:** `arquivo` e `lead` sempre carimbados com `conta_id` do usuário logado (nunca do arquivo).
- **Dedupe:** se o telefone/CPF extraído já existir na conta, avisar antes de salvar (mesma regra do cadastro manual).
- **Privacidade/LGPD:** o PDF contém dado pessoal — guardar em bucket privado, acesso só via URL assinada e escopo da conta. Não enviar o arquivo pra lugar nenhum além do provedor de IA usado na extração.

**Dependências:** Storage de arquivos + Claude API (§4). Reaproveita `interacoes` e a estrutura de `leads`.

**MoSCoW:** Must — upload + anexar PDF ao lead + fallback manual. Should — extração automática por IA + tela de confirmação pré-preenchida. Could — casar produto extraído com `produtos` da conta e já sugerir a venda. Won't (MVP) — extração de planilhas da operadora em lote (v1.1), OCR de imagem/foto (v2).

> **Nota de esforço:** este módulo adiciona ~2-3 semanas (storage + fila assíncrona + prompt de extração + tela de revisão). Vale definir se entra como **Must** ou **Should** do MVP — recomendo Should, lançando primeiro o cadastro manual e ativando a extração logo em seguida com PDFs reais da vertical de lançamento.

---

### 6.4 Funil Kanban
**Objetivo:** o coração operacional do CRM. Corretor deve conseguir mover 20 leads em 2 minutos.

**Estágios (fixos no MVP):**
1. Prospectos (prob. default 5%)
2. Qualificados (20%)
3. Proposta Enviada (40%)
4. Negociação (60%)
5. Finalização (80%)
6. Venda Concluída (100%)

**Componentes:**
- 6 colunas horizontais com scroll
- Card do lead mostra: nome, produto de interesse, valor previsto (se houver), dias sem contato, avatar do dono
- Drag-and-drop entre colunas
- Botão "Novo Lead" flutuante
- Filtros: Meus / Todos, ativo/todos, busca

**Regras críticas:**
- Mover para "Venda Concluída" **abre modal de registro de venda** (produto, valor, forma de pagamento). Só cria a venda ao confirmar. Se cancelar, card volta ao estágio anterior.
- Cada movimentação registra `interacao` automática.
- Card com mais de 7 dias sem interação recebe badge visual amarelo. Mais de 14 dias, vermelho.

**Visualização alternativa:** botão "Tabela" mostra a mesma lista em grid com colunas ordenáveis (nome, estágio, valor, dono, dias sem contato).

**MoSCoW:** Must — Kanban com drag, modal de venda ao concluir. Should — visão tabela, badges de tempo. Won't — customizar estágios por conta (v2).

---

### 6.5 Produtos e regras de comissão
**Objetivo:** o cérebro financeiro. Se errar aqui, o corretor perde a confiança e cancela.

**Telas:**
- Lista de produtos (tabela)
- Modal "Novo Produto"
- Modal "Editar Produto"

**Campos (Novo Produto):**

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| Nome do produto | texto | sim | mín. 3 |
| Categoria | select | sim | Consórcio / Seguro / Plano de Saúde / Imobiliário |
| Descrição | textarea | não | livre |
| Tipo de comissão | radio | sim | Parcelas limitadas / Recorrente |
| Nº de parcelas | número | sim se limitada | 1-120 |
| Percentual de comissão | decimal % | sim | 0,01-100 |
| Início do pagamento | radio | sim | Mês seguinte à venda / Mesmo mês da venda |
| Dia do pagamento | número | sim se "mesmo mês" | 1-28 |
| Produto ativo | toggle | sim | default true |

**Regras de cálculo (crítico):**
- Ao criar venda com um produto:
  - Se `tipo_comissao = 'limitada'` e `parcelas = N`: gera N registros em `comissoes`, cada um com `valor_parcela = venda.valor * percentual / N`.
  - Se `tipo_comissao = 'recorrente'`: gera 12 registros iniciais (limite MVP para não estourar banco), com renovação manual depois.
  - Data prevista da 1ª parcela:
    - "Mês seguinte": dia 5 do mês seguinte à venda.
    - "Mesmo mês": `dia_pagamento` do mês da venda (se dia já passou, joga pro mês seguinte).
  - Parcelas subsequentes seguem intervalo mensal.

**Casos de teste obrigatórios antes de lançar:**
1. Consórcio 30 parcelas de 1,5%, R$ 100k → 30 comissões de R$ 50 cada.
2. Seguro auto 1 parcela de 20%, R$ 3k → 1 comissão de R$ 600, mês seguinte.
3. Plano de saúde recorrente 5%, R$ 800/mês → 12 comissões de R$ 40, começando no mês seguinte.

**MoSCoW:** Must — todos os campos e cálculos acima. Should — clonar produto. Won't (MVP) — comissão dupla, modelo Bônus+Vitalício, modelo Diluída.

---

### 6.6 Vendas e comissões
**Objetivo:** ver o que foi vendido, o que já entrou e o que ainda vai entrar de comissão.

**Telas:**
- Lista de vendas (tabela)
- Detalhe da venda (com parcelas de comissão)
- Lista de comissões (visão calendário mensal)

**Campos da venda** (preenchidos no modal de "Venda Concluída" no funil):

| Campo | Tipo | Obrigatório |
|---|---|---|
| Produto | select | sim |
| Valor do negócio | moeda R$ | sim |
| Forma de pagamento | select | sim |
| Data da venda | data | sim (default hoje) |
| Observações | textarea | não |

**Formas de pagamento:** Débito em conta, Boleto, Pix, Cartão de Crédito, Dinheiro, Outro.

**Regras:**
- Criar venda → cria as parcelas de comissão automaticamente (regra do produto).
- Marcar parcela como "recebida" preenche `data_recebida`, entra no KPI "Comissão recebida".
- Cancelar venda → parcelas viram `status = 'cancelada'`, saem dos KPIs.

**Filtros da lista de vendas:** período, status (Concluída/Cancelada), produto, vendedor.

**Exportação:** botão "Exportar CSV" com todas as vendas do filtro. (PDF de fechamento fica pra v1.1.)

**MoSCoW:** Must — criar venda a partir do funil, gerar parcelas, marcar recebida. Should — visão calendário de comissões, exportação CSV. Won't — comissão avulsa fora de venda (v1.1).

---

### 6.7 Agenda
**Objetivo:** não deixar cair compromisso. Simples de propósito.

**Telas:**
- Calendário mensal
- Modal "Novo Compromisso"

**Campos:**

| Campo | Tipo | Obrigatório |
|---|---|---|
| Título | texto | sim |
| Lead vinculado | select | não |
| Data e hora início | datetime | sim |
| Data e hora fim | datetime | sim |
| Descrição | textarea | não |

**Regras:**
- Compromisso vinculado a lead aparece no histórico do lead.
- Notificação por email 1h antes (usando cron simples).

**MoSCoW:** Must — CRUD básico. Should — email de lembrete. Won't (MVP) — recorrência, convite pra terceiros, integração Google Calendar.

---

### 6.8 Assinatura simples
**Objetivo:** cobrar o corretor sem virar projeto paralelo.

**Modelo:** R$ 59/mês por usuário (mesma faixa do concorrente crm-corretor.top). Trial de 14 dias. Cancelamento a qualquer momento.

**Telas:**
- Página "Minha assinatura" (status, próxima cobrança, botão trocar cartão, botão cancelar)
- Fluxo de checkout Asaas (redirect ou iframe)

**Regras:**
- Fim do trial sem assinatura → conta suspensa, login bloqueado com tela "Assine para continuar".
- Falha de cobrança → 3 tentativas em 7 dias, depois suspende.
- Cancelamento é imediato ao fim do ciclo pago atual.

**MoSCoW:** Must — trial, cobrança mensal, suspensão. Should — troca de cartão pela UI. Won't (MVP) — anual, cupom de desconto, plano por faixa (v1.1).

---

## 7. Métricas de sucesso do MVP
O MVP é considerado bem-sucedido se, **90 dias após o lançamento**, atingir:

| Métrica | Meta MVP |
|---|---|
| Contas em trial iniciado | 100 |
| Conversão trial → pago | ≥ 15% |
| Churn mensal | ≤ 10% |
| DAU / MAU | ≥ 30% |
| Vendas registradas por conta pagante ativa (mês) | ≥ 3 |
| NPS informal (mensagem WhatsApp direta) | ≥ 40 |

Se qualquer uma dessas ficar muito abaixo, é hora de conversar com 10 clientes antes de escrever qualquer código novo.

---

## 8. Roadmap

### MVP (mês 1-4)
Tudo que está na seção 6.

### v1.1 (mês 5-6, após validação com 20+ pagantes)
- Comissão dupla (Corretor + Corretora) exposta na UI
- Papel Secretária
- Gestão de Carteira / Renovações (negócio avulso, apólices, alerta de vencimento)
- Central de Prioridades com score simples
- Importação de propostas em lote / planilhas da operadora
- Exportação de fechamento em PDF
- Plano anual com 20% de desconto
- Notificações in-app

### v2 (mês 7-12)
- BI completo (forecast, health score, gargalos)
- Simulador de Consórcio
- Gerador de Propostas em PDF
- Pós-Vendas com esteira automática
- Despesas e resultado líquido
- Landing Page personalizada
- Desempenho comparativo entre vendedores
- Hierarquia (Vendedor/Líder/Gerente)

### v2.5 (mês 13+)
- WhatsApp com IA
- Extrator Google Maps (extensão de navegador)
- Integração com Meta Ads / Google Ads para tracking de origem

---

## 9. Perguntas abertas
Antes de escrever a primeira linha de código, decidir:

1. **Vertical de lançamento**: Consórcio ou Seguros?
2. **Stack final**: Next.js/Prisma ou Laravel/Livewire? (impacto de 2-3 semanas) — obs.: o repo atual já é React+Vite / Node+Express / Supabase; migrar de stack joga fora a fundação de auth + multi-tenant que já existe.
3. **Hosting**: gerenciado (Railway/Vercel) ou VPS próprio? (impacto de custo e tempo)
4. **Marca**: fica "fideliza-corretor" mesmo ou tem nome comercial diferente? Precisa registrar?
5. **CNPJ**: já aberto ou vai abrir? Simples Nacional Anexo III ou V?
6. **Jurídico**: quem vai fazer LGPD + termos + política? Orçamento reservado? (o cadastro por PDF guarda dado pessoal — a política precisa cobrir isso)
7. **Design**: você desenha ou contrata? Design system baseado em shadcn resolve?
8. **Beta**: quem são os 5 primeiros beta users? Já tem lista?
9. **Preço final**: R$ 59 igual concorrente, R$ 39 pra entrar barato, ou R$ 79 posicionando premium?
10. **Suporte**: só você atendendo WhatsApp? Até quantos clientes isso escala?
11. **Extração de PDF**: quais layouts de proposta suportar primeiro? Cada operadora/administradora tem um PDF diferente — recomendo começar por 1-2 modelos mais comuns da vertical de lançamento e ampliar com propostas reais dos beta users. É Must ou Should do MVP?

---

**Próximos passos concretos:**
1. Responder as 11 perguntas acima (papel + caneta, 1 hora).
2. Abrir CNPJ (paralelo, ~15 dias).
3. Contratar advogado LGPD (paralelo, orçamento em 3 escritórios).
4. Iniciar sprint 1: signup + login + estrutura multi-tenant + tela de leads (2 semanas).

*Fim do documento.*
