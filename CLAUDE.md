# CLAUDE.md — Fideliza Corretor

> Arquivo lido pelo Claude Code toda sessão. Fonte de verdade **completa**: `docs/INSTRUCOES-PROJETO.md`.

## O que é
SaaS multi-tenant de pós-venda para corretores independentes de plano de saúde no Brasil. O corretor cadastra o cliente uma vez e o sistema cuida do relacionamento sozinho (WhatsApp, e-mail, alertas) — princípio "set and forget".

## Stack
- Frontend: React + Vite + TailwindCSS
- Backend: Node.js + Express
- Banco: Supabase (PostgreSQL) — **service role key** no backend
- E-mail: Resend
- WhatsApp: Meta Cloud API oficial (direto, sem Twilio/360dialog)
- IA: Claude API (extração de PDF + agente conversacional)
- Host: Railway (plano pago — cron não pode hibernar)

## ⚠️ REGRA CRÍTICA — ISOLAMENTO DE TENANT (leia antes de tudo)
O backend usa a **SERVICE ROLE KEY** do Supabase, que **BYPASSA a RLS por completo**.
O isolamento entre tenants depende EXCLUSIVAMENTE de `WHERE tenant_id = $tenantId`
na camada de **repositories**. TODA query precisa desse filtro, sem exceção.
`tenant_id` SEMPRE vem do JWT do usuário autenticado — NUNCA do body da requisição.
**Query sem tenant_id = pare e corrija antes de continuar.**

### Única exceção autorizada (decisão do Pedro — 20/07/2026): painel interno cross-tenant
A equipe interna da Fideliza (`role` `funcionario`/`admin`, `status` `ativo`) tem um
**painel de controle interno** que consulta `clientes` de **todos os tenants**. Essa é a
ÚNICA leitura cross-tenant do sistema. Ela vive num caminho separado e marcado:
`repositories/internalRepository.js` + middleware `requireInternal`. Corretores continuam
100% isolados por `tenant_id`. Não replicar esse padrão em nenhum outro lugar — qualquer
outra query sem `tenant_id` continua sendo bug.

## Autenticação e papéis (Supabase Auth + tabela `users`)
Um único sistema de login (Supabase Auth) para todos; o que muda é o comportamento no perfil.
- **`corretor`** — dono do tenant. Cadastro self-service público → `status='ativo'` na hora.
  Acessa só a própria carteira.
- **`funcionario`** — equipe interna. Cadastro na área da equipe (`/equipe/*`) → `status='pendente'`.
  Só acessa o painel interno depois que um `admin` aprova.
- **`admin`** — equipe interna com poder de aprovar funcionários. Semeado via allowlist
  `equipe_pre_aprovada` (migration 003) ou aprovado por outro admin.
- Funcionários/admins pertencem ao **tenant de plataforma** `11111111-1111-1111-1111-111111111111`.
- `authMiddleware` bloqueia quem não tem perfil; o bloqueio de `status != 'ativo'` é por rota
  (`requireAtivo`), para o endpoint `/me` ainda responder a funcionário pendente.
- **NÃO usamos RLS** (mantido): isolamento é app-layer via `tenant_id`. Migrations 001 e 003.

## Tema (decisão do Pedro — 20/07/2026)
- Telas de login/cadastro são **sempre claras** (regra do fundo branco, sem exceção).
- **Depois de autenticado**, há um toggle de **dark mode** como preferência pessoal do usuário
  (persistida em `localStorage`, aplicada via `data-theme="dark"` no `<html>`). Isso não fere a
  regra do fundo claro porque só existe pós-login.

## Estrutura de pastas
```
backend/src/
  routes/         # define endpoints, extrai tenant_id do JWT
  controllers/    # orquestra request -> service -> response
  services/       # regras de negócio (score, alertas, cron)
  repositories/   # acesso ao banco — TODA query filtra por tenant_id
  middlewares/    # auth, validação, tratamento de erro
  migrations/     # SQL versionado (Supabase)
frontend/src/
  pages/          # telas
  components/     # componentes reutilizáveis
  hooks/          # lógica de estado
  services/       # chamadas à API
```

## Identidade visual (decisão do Pedro — 20/07/2026)
- **Fundo branco/claro é o padrão de TODAS as telas, sem exceção** (login incluído, convertido em 20/07/2026).
- Tokens (Tailwind v4, via `@theme` em `frontend/src/index.css`): `brand-blue #1E5EFF` (primária — botões, links, ativos), `brand-blue-dark #174EA6` (hover), `brand-navy #0F1B2D` (texto de destaque), `brand-amber #F5A623` (destaque pontual — badges/alertas; NUNCA fundo grande ou botão).
- Texto sobre `brand-blue` é sempre branco. Headings em Poppins, corpo em Inter.
- Logos oficiais: originais em `frontend/src/assets/logo/`, versões web otimizadas em `assets/logo/web/`, componente `<Logo />` (`frontend/src/components/Logo.jsx`) com as variantes. Em fundo claro: colorida; em fundo escuro: negativa. Não recriar/alterar as artes.

## Convenções
- Código (variáveis/funções) em inglês; conteúdo pro usuário em português.
- Tabelas e colunas em português snake_case (ver modelo de dados nas Instruções — usar os nomes exatos).
- Toda rota autenticada valida o tenant_id do usuário logado.
- Chaves sempre em variáveis de ambiente, nunca hardcoded.
- Erros logados com contexto (tenant_id, cliente_id quando aplicável).
- Commits pequenos e frequentes, mensagens em português.

## Fase atual: FASE 1 — Base + Score de completude
Escopo agora: Supabase multi-tenant, formulário web de cadastro, cálculo do score de completude, lista de clientes com filtro "incompletos".
FORA de escopo agora (não implementar): cron/e-mail (F2), WhatsApp/agente (F3), frontend definitivo (F4), RAG/teto de consultas/PDF (F5), churn score/Stripe (F6). **Não pular fases.**

## Score de completude (calculado ao salvar o cliente)
- **Obrigatórios** (bloqueiam alertas se vazios): nome, telefone_whatsapp, data_inicio_plano, operadora.
- **Importantes** (−10% cada): data_aniversario, email, tipo_plano.
- **Complementares** (−5% cada): nivel_sinistralidade, data_encerramento, carencia_meses, qtd_dependentes.
- Score < 60%: agente lembra o corretor dos campos faltantes.
- Score < 40%: alertas automáticos suspensos para aquele cliente.

## Checklist antes de implementar qualquer coisa
1. Toda query tem `WHERE tenant_id = $tenantId`?
2. O tenant_id vem do JWT (e não do body)?
3. Isso é da Fase 1, ou estou puxando escopo de fase futura?
4. Estou usando os nomes de tabela/coluna exatos do modelo de dados?
5. Reduz ou aumenta o esforço contínuo do corretor? (set and forget)
