// =============================================================================
// run-jobs — dispara os jobs diários via HTTP (usado pelo serviço de cron do
// Railway). Lê JOB_URL e JOB_SECRET do ambiente, faz POST em cada endpoint de
// job e encerra com exit 0 (sucesso) ou 1 (alguma falha) — o cron do Railway
// espera um processo que termina.
//
// Uso (Custom Start Command no serviço de cron):
//   node scripts/run-jobs.js
// =============================================================================

const JOBS = ['recalcular-carteira', 'recalcular-posvendas', 'recalcular-bi'];

async function main() {
  const base = process.env.JOB_URL;
  const secret = process.env.JOB_SECRET;

  if (!base) {
    console.error('JOB_URL não definido. Ex.: https://seu-backend.up.railway.app');
    process.exit(1);
  }
  if (!secret) {
    console.error('JOB_SECRET não definido (precisa ser o mesmo do backend).');
    process.exit(1);
  }

  const url = base.replace(/\/+$/, ''); // remove barra(s) finais
  let houveFalha = false;

  for (const job of JOBS) {
    const alvo = `${url}/api/jobs/${job}`;
    try {
      const resp = await fetch(alvo, {
        method: 'POST',
        headers: { 'x-job-secret': secret },
      });
      const corpo = await resp.text();
      console.log(`[${job}] HTTP ${resp.status} ${corpo}`);
      if (!resp.ok) houveFalha = true;
    } catch (err) {
      console.error(`[${job}] falha de conexão: ${err.message}`);
      houveFalha = true;
    }
  }

  process.exit(houveFalha ? 1 : 0);
}

main();
