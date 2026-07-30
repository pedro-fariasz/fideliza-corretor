// =============================================================================
// backfill-apolices — cria apólices para vendas antigas concluídas que ficaram
// sem apólice (bug: a apólice estava atrás de feature flag, então a esteira de
// pós-venda ficava vazia). Roda MANUALMENTE, uma vez, após o deploy:
//
//   node backend/scripts/backfill-apolices.js
//
// NUNCA roda no boot. Idempotente: reusa apolicesService.gerarDeVendaComLead,
// que só cria apólice se ainda não existir uma para aquela venda (venda_id).
// Cross-tenant (script de manutenção, service role) — cada apólice herda o
// tenant_id da sua venda.
// =============================================================================
require('dotenv').config();

const { supabase } = require('../src/config/supabase');
const produtosRepository = require('../src/repositories/produtosRepository');
const leadsRepository = require('../src/repositories/leadsRepository');
const apolicesService = require('../src/services/apolicesService');

async function main() {
  // Vendas concluídas com lead (apólice precisa de cliente, que vem do lead).
  const { data: vendas, error: eVendas } = await supabase
    .from('vendas')
    .select('*')
    .eq('status', 'concluida')
    .not('lead_id', 'is', null);
  if (eVendas) throw eVendas;

  // Vendas que já têm apólice — para não duplicar.
  const { data: apolices, error: eApol } = await supabase
    .from('apolices')
    .select('venda_id')
    .not('venda_id', 'is', null);
  if (eApol) throw eApol;

  const comApolice = new Set((apolices || []).map((a) => a.venda_id));
  const pendentes = (vendas || []).filter((v) => !comApolice.has(v.id));

  let processadas = 0;
  let criadas = 0;

  for (const venda of pendentes) {
    processadas += 1;
    try {
      const produto = await produtosRepository.findById(venda.tenant_id, venda.produto_id);
      if (!produto) {
        console.warn(`  [skip] venda ${venda.id}: produto ${venda.produto_id} não encontrado.`);
        continue;
      }
      const lead = await leadsRepository.findById(venda.tenant_id, venda.lead_id);
      if (!lead) {
        console.warn(`  [skip] venda ${venda.id}: lead ${venda.lead_id} não encontrado.`);
        continue;
      }
      // Idempotente: gerarDeVendaComLead -> gerarDeVenda checa findByVenda antes.
      await apolicesService.gerarDeVendaComLead(venda.tenant_id, venda, produto, lead);
      criadas += 1;
    } catch (err) {
      console.error(`  [erro] venda ${venda.id}: ${err.message}`);
    }
  }

  console.log(`Vendas processadas: ${processadas} | Apólices criadas: ${criadas}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill falhou:', err.message);
    process.exit(1);
  });
