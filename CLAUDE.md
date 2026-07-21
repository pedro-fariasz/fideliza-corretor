# CLAUDE.md — Fideliza Corretor

> Arquivo lido pelo Claude Code toda sessão. Fonte de verdade **completa**:
> `docs/INSTRUCOES-PROJETO.md` (projeto) + `docs/PRD-fideliza-corretor.md` (escopo do MVP).

## O que é
CRM SaaS multi-tenant para **corretores autônomos brasileiros** gerenciarem **leads, funil de vendas e comissões**, começando por **uma vertical** (consórcio, seguro, plano de saúde ou imobiliário). Diferenciais do MVP: (1) cálculo de comissão que faz sentido pro mercado BR — parcelada/recorrente, com início de pagamento configurável; (2) cadastro do cliente **sem digitação, via PDF da proposta** — a IA extrai os dados, o corretor confirma e salva.

> ⚠️ **Mudança de rumo (21/07/2026).** O projeto nasceu como SaaS de **pós-venda puro só de plano de saúde** ("set and forget"). Agora é um **CRM de vendas multi-vertical** (decisão do Pedro; ver PRD). O pós-venda automático (esteira, alertas, score de completude) foi **reposicionado para v2**. As tabelas antigas (`clientes`, `alertas`, `templates`, `historico_disparos`, `sessoes_whatsapp`) **permanecem no banco**, mas ficam **fora do escopo do MVP atual** — não construir em cima delas agora.

## Stack
- Frontend: React + Vite + TailwindCSS
- Backend: Node.js + Express
- Banco: Supabase (PostgreSQL) — **service role key** no backend
- Storage: Supabase Storage — bucket **privado** `propostas` (PDFs de proposta)
- E-mail: Resend
- IA: **Claude API** — extração dos dados do PDF da proposta (agente conversacional só em fase futura)
- Pagamentos: **Asaas** (sugestão do PRD — Pix nativo, BR-first). Decisão final pendente (Stripe era a escolha anterior).
- WhatsApp: **fora do MVP** (v2.5). Quando entrar, **Meta Cloud API oficial** — decisão de risco: **nunca** Evolution/Z-API (banimento em massa).
- Host: Railway (plano pago — cron não pode hibernar)

## ⚠️ REGRA CRÍTICA — ISOLAMENTO DE TENANT (leia antes de tudo)
O backend usa a **SERVICE ROLE KEY** do Supabase, que **BYPASSA a RLS por completo**.
O isolamento entre tenants depende EXCLUSIVAMENTE de `WHERE tenant_id = $tenantId`
na camada de **repositories**. TODA query precisa desse filtro, sem exceção.
`tenant_id` SEMPRE vem do JWT do usuário autenticado — NUNCA do body da requisição.
**Query sem tenant_id = pare e corrija antes de continuar.**

Isso vale para TODAS as tabelas novas do CRM (`leads`, `produtos`, `vendas`, `comissoes`,
`interacoes`, `compromissos`, `arquivos`) — todas carregam `tenant_id`, inclusive as que
"poderiam" chegar por join (ex.: `comissoes`), porque relatórios as consultam direto.

### Única exceção autorizada (decisão do Pedro — 20/07/2026): painel interno cross-tenant
A equipe interna da Fideliza (`role` `funcionario`/`admin`, `status` `ativo`) tem um
**painel de controle interno** cross-tenant. Essa é a ÚNICA leitura sem `tenant_id`.
Vive num caminho separado e marcado: `repositories/internalRepository.js` + middleware
`requireInternal`. Não replicar esse padrão em nenhum outro lugar — qualquer outra query
sem `tenant_id` continua sendo bug.

## Autenticação e papéis (Supabase Auth + tabela `users`)
Login único (Supabase Auth) para todos; o que muda é o comportamento por perfil.
- **`corretor`** — dono do tenant/conta. Cadastro self-service público → `status='ativo'` na hora.
  Acessa só a própria carteira. **É o perfil central do MVP.**
- **`funcionario`** — equipe interna Fideliza. Cadastro na área da equipe → `status='pendente'`.
  Só acessa o painel interno depois que um `admin` aprova.
- **`admin`** — equipe interna com poder de aprovar funcionários. Semeado via allowlist
  `equipe_pre_aprovada` (migration 003) ou aprovado por outro admin.
- Funcionários/admins pertencem ao **tenant de plataforma** `11111111-1111-1111-1111-111111111111`.
- `authMiddleware` bloqueia quem não tem perfil; o bloqueio de `status != 'ativo'` é por rota
  (`requireAtivo`), para o endpoint `/me` ainda responder a funcionário pendente.
- **NÃO usamos RLS**: isolamento é app-layer via `tenant_id`. Migrations 001 e 003.
- Hierarquia comercial (Vendedor/Líder/Gerente) e o papel **Secretária** ficam para **v1.1** — não implementar no MVP.

### `is_platform_admin` — super-admin de plataforma (migration 004)
Flag booleana em `users`, **ortogonal ao `role`**, marca o super-admin da plataforma (Pedro).
Mantida como **marcador reservado**: nenhuma rota exige a flag ainda; quando for usada, só em
`/api/admin/*` e **NUNCA** para bypassar `tenant_id`. Não confundir com o `role` `admin`.

## Tema
- Telas de login/cadastro são **sempre claras** (regra do fundo branco, sem exceção).
- **Depois de autenticado**, toggle de **dark mode** como preferência pessoal (persistida em
  `localStorage`, aplicada via `data-theme="dark"` no `<html>`).

## Identidade visual
- **Fundo branco/claro é o padrão de TODAS as telas** (login incluído).
- Tokens (Tailwind v4, via `@theme` em `frontend/src/index.css`): `brand-blue #1E5EFF` (primária),
  `brand-blue-dark #174EA6` (hover), `brand-navy #0F1B2D` (texto de destaque), `brand-amber #F5A623`
  (destaque pontual — NUNCA fundo grande ou botão).
- Texto sobre `brand-blue` é sempre branco. Headings em Poppins, corpo em Inter.
- Logos oficiais em `frontend/src/assets/logo/`, componente `<Logo />`. Não recriar/alterar as artes.

## Estrutura de pastas
```
backend/
  migrations/     # SQL versionado (Supabase) — 001..007
  src/
    routes/       # define endpoints, extrai tenant_id do JWT
    controllers/  # orquestra request -> service -> response
    services/     # regras de negócio (cálculo de comissão, extração de PDF)
    repositories/ # acesso ao banco — TODA query filtra por tenant_id
    middlewares/  # auth, validação, tratamento de erro
    config/       # supabase client, constants
frontend/src/
  pages/ components/ hooks/ services/
```

## Convenções
- Código (variáveis/funções) em inglês; conteúdo pro usuário em português.
- Tabelas e colunas em português snake_case (usar os nomes exatos do modelo de dados).
- Toda rota autenticada valida o `tenant_id` do usuário logado.
- Chaves sempre em variáveis de ambiente, nunca hardcoded.
- Erros logados com contexto (`tenant_id`, `lead_id`/`venda_id` quando aplicável).
- Commits pequenos e frequentes, mensagens em português.

## Fase atual: MVP — CRM de vendas
Escopo agora (ver PRD §6): **auth + conta com trial de 14 dias**, **leads** (cadastro manual +
via PDF da proposta), **funil Kanban** 6 estágios com drag-and-drop, **produtos** com regra de
comissão (Fixa %, parcelada/recorrente, início do pagamento), **venda nascida do funil**,
**cálculo de comissão em parcelas**, **dashboard** de KPIs, **agenda** simples, **assinatura** (Asaas).

FORA de escopo agora (v1.1+, **não puxar**): comissão dupla na UI, secretária, hierarquia,
renovações/carteira, central de prioridades, BI (forecast/health score/gargalos), pós-vendas
(esteira/templates), simulador de consórcio, gerador de propostas em PDF, WhatsApp com IA,
landing page, extrator Google Maps, despesas, desempenho. **Não pular fases.**

## Modelo de dados — MVP CRM (migrations 006–007)
Novas: `leads`, `produtos`, `vendas`, `comissoes`, `interacoes`, `compromissos`, `arquivos`.
Colunas novas em `tenants`: `vertical`, `trial_termina_em`, `asaas_customer_id`, `asaas_subscription_id`.
- `comissoes` é tabela **separada** de `vendas`: 1 venda → N parcelas, cada uma com `data_prevista`
  (destrava "comissão a receber por mês" sem gambiarra). Tem `beneficiario` (`corretor`/`corretora`)
  já pronto pra comissão dupla — no MVP a UI só usa `corretor`.
- `arquivos` guarda o PDF da proposta (bucket `propostas`) + `dados_extraidos_json` da IA.
- `interacoes` é a timeline do lead; o funil escreve nela automaticamente.
Legadas (pós-venda, fora do MVP): `clientes`, `alertas`, `historico_disparos`, `templates`, `sessoes_whatsapp`.

## Checklist antes de implementar qualquer coisa
1. Toda query tem `WHERE tenant_id = $tenantId`?
2. O `tenant_id` vem do JWT (e não do body)?
3. Isso é do MVP, ou estou puxando escopo de v1.1/v2?
4. Estou usando os nomes de tabela/coluna exatos do modelo de dados?
5. Reduz o atrito do corretor? (cadastro rápido, comissão clara)
