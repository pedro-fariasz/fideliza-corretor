# Pendências — Fideliza Corretor

> Atualizado em 18/07/2026, após o deploy da Fase 1 na nuvem.
> Ambiente: Supabase (projeto `fideliza-crm`, São Paulo) + Railway (projeto `perceptive-purpose`).

## Produção (Fase 1 no ar)

| Serviço | URL |
|---|---|
| Frontend | https://distinguished-inspiration-production-e883.up.railway.app |
| Backend (API) | https://fideliza-corretor-production-207b.up.railway.app |
| Healthcheck | https://fideliza-corretor-production-207b.up.railway.app/health |

O que já foi feito e verificado:
- Migrations 001 e 002 aplicadas no Supabase (7 tabelas + coluna `aceita_felicitacao_aniversario`).
- Usuário admin criado no Supabase Auth e vinculado ao tenant demo na tabela `users`.
- Backend no Railway com root directory `/backend`, variáveis reais e CORS liberando
  `http://localhost:5173` + o domínio do frontend.
- Frontend no Railway com root directory `/frontend` e as 3 variáveis `VITE_*`.
- `/health` respondendo `{"status":"ok"}`; app servindo a tela de login sem erros de console.

## Pendências abertas

### Imediatas (fecham a Fase 1)
- [ ] **Teste de ponta a ponta**: logar no frontend de produção, cadastrar um cliente real e
      conferir o `score_completude` na lista. (O 401 "Invalid API key" foi corrigido recolando a
      `SUPABASE_SERVICE_ROLE_KEY` no Railway; falta revalidar o fluxo completo após o redeploy.)
- [ ] **Critério oficial da fase**: mãe cadastrando clientes reais sem ajuda.

### Higiene do Railway (baixo risco, sem pressa)
- [ ] Apagar o projeto vazio **`jubilant-wholeness`** (criado por clique duplicado) —
      Project Settings → Danger.
- [ ] Renomear o serviço **`distinguished-inspiration`** para `fideliza-frontend`
      (Settings do serviço → nome). O domínio público gerado não muda.
- [ ] Remover ou preencher as **variáveis placeholder** adicionadas em bloco pelas
      "Suggested Variables" nos dois serviços (`APP_URL`, `JWT_SECRET`, `RESEND_*`,
      `WHATSAPP_*` etc.). Nada as usa na Fase 1; nas Fases 2–3 receberão valores reais.
      ⚠️ Ao mexer nas variáveis, NUNCA sobrescrever `SUPABASE_SERVICE_ROLE_KEY`,
      `SUPABASE_URL`, `CORS_ORIGIN` e as `VITE_*` — foi exatamente assim que o 401 aconteceu.

### Antes da Fase 2
- [ ] **Plano Hobby do Railway** (~US$5/mês): o cron de e-mails não pode hibernar; conta está
      no plano gratuito/trial.
- [ ] Preencher `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME` com valores reais.

### Antes da Fase 3 (lembretes de arquitetura)
- [ ] O cron de aniversário SÓ pode disparar `aniversario_cliente` quando
      `clientes.aceita_felicitacao_aniversario = TRUE` (consentimento LGPD + regras da Meta —
      ver comentário na migration 002).
- [ ] Preencher variáveis `WHATSAPP_*` com credenciais reais da Meta Cloud API.

### Futuras (sem fase definida)
- [ ] Domínio próprio (Cloudflare) no lugar dos `*.up.railway.app`.
- [ ] Onboarding real de tenant (Fase 6) — hoje o único tenant é o demo
      (`00000000-0000-0000-0000-000000000000`).

## Para desenvolver localmente (qualquer PC)
Clonar o repo, `npm install` em `backend/` e `frontend/`, copiar os dois `.env.example` para
`.env` e preencher (ver READMEs). O uso do sistema em produção não exige nada disso — basta a
URL do frontend no navegador.

### Testes de frontend (anotação — PR 9, jul/2026)
- [ ] Cobrir `traduzirAcao(acao)` (feed de Atividades em `InteligenciaPage.jsx`) com
      teste unitário quando o projeto adotar runner de teste no frontend. A função foi
      exportada de propósito para facilitar isso. O backend de `/api/atividades` já tem
      testes (`backend/tests/atividades.test.js`: isolamento por tenant, filtros, limite).
