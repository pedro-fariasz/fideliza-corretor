// =============================================================================
// Seed da Fase 1 — Gestão de Carteira.
// Cria dados realistas p/ testar o pipeline e as 7 métricas: 3 corretores,
// ~50 clientes, ~80 apólices (ativas, renovadas c/ histórico, canceladas c/
// motivo) espalhadas em ~6 meses, com vendas e comissões.
//
// Uso:  cd backend && node seeds/fase1_carteira.js <TENANT_ID>
//   (precisa de SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env)
//
// ⚠️ Aditivo (não limpa dados). Os "corretores" criados são só dados (sem
//    Supabase Auth) — servem de dono/histórico, não fazem login.
// =============================================================================
require('dotenv').config();
const crypto = require('crypto');
const { supabase } = require('../src/config/supabase');
const comissaoService = require('../src/services/comissaoService');

const TENANT_ID = process.argv[2];
if (!TENANT_ID) {
  console.error('Informe o TENANT_ID: node seeds/fase1_carteira.js <tenant_id>');
  process.exit(1);
}

const uuid = () => crypto.randomUUID();
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const iso = (d) => d.toISOString().slice(0, 10);
function diasFromHoje(dias) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dias);
  return iso(d);
}
const NOMES = ['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Diego Rocha', 'Eva Nunes', 'Felipe Alves', 'Gabi Melo', 'Hugo Reis', 'Isa Prado', 'João Vaz'];

async function main() {
  console.log(`Seed Fase 1 no tenant ${TENANT_ID}...`);

  // 1) Corretores (dados-only)
  const corretores = [];
  for (let i = 1; i <= 3; i += 1) {
    const id = uuid();
    const { error } = await supabase.from('users').insert({
      id, tenant_id: TENANT_ID, email: `seed.corretor${i}.${id.slice(0, 6)}@exemplo.com`,
      nome: `Corretor Seed ${i}`, role: 'corretor', status: 'ativo',
      papel_conta: 'corretor', cargo: 'vendedor', ativo: true,
    });
    if (error) throw error;
    corretores.push(id);
  }

  // 2) Produtos (garante 2 com vigência)
  const produtos = [];
  for (const p of [
    { nome: 'Seguro Auto Seed', categoria: 'seguro', tipo_comissao: 'limitada', parcelas_limite: 1, percentual: 20, vigencia_meses: 12 },
    { nome: 'Plano Saúde Seed', categoria: 'saude', tipo_comissao: 'recorrente', percentual: 5, vigencia_meses: 12 },
  ]) {
    const { data, error } = await supabase.from('produtos')
      .insert({ tenant_id: TENANT_ID, inicio_pagamento: 'mes_seguinte', ativo: true, ...p })
      .select('id, tipo_comissao, percentual, parcelas_limite, inicio_pagamento, dia_pagamento, vigencia_meses').single();
    if (error) throw error;
    produtos.push(data);
  }

  // 3) Clientes
  const clientes = [];
  for (let i = 0; i < 50; i += 1) {
    const id = uuid();
    const nps = Math.random() < 0.6 ? randInt(0, 10) : null; // 60% responderam
    const { error } = await supabase.from('carteira_clientes').insert({
      id, tenant_id: TENANT_ID, nome: `${rand(NOMES)} ${i}`,
      telefone: `1199999${String(1000 + i).slice(-4)}`, nps,
    });
    if (error) throw error;
    clientes.push(id);
  }

  // helper: cria venda + comissões e devolve venda_id
  async function criarVendaComComissoes(produto, valor, dataVenda, corretorId) {
    const vendaId = uuid();
    const { error: ev } = await supabase.from('vendas').insert({
      id: vendaId, tenant_id: TENANT_ID, produto_id: produto.id, vendedor_id: corretorId,
      valor, forma_pagamento: 'pix', data_venda: dataVenda, status: 'concluida',
    });
    if (ev) throw ev;
    const parcelas = comissaoService.calcularComissoes({ valor, dataVenda, produto });
    const rows = parcelas.map((p) => ({
      tenant_id: TENANT_ID, venda_id: vendaId, beneficiario: p.beneficiario, percentual: p.percentual,
      valor_parcela: p.valor_parcela, num_parcela: p.num_parcela, total_parcelas: p.total_parcelas,
      data_prevista: p.data_prevista, status: Math.random() < 0.4 ? 'recebida' : 'projetada',
      data_recebida: null,
    }));
    const { error: ec } = await supabase.from('comissoes').insert(rows);
    if (ec) throw ec;
    return vendaId;
  }

  // 4) Apólices (~80): mistura de situações
  let ativas = 0, renovadas = 0, canceladas = 0;
  for (let i = 0; i < 80; i += 1) {
    const produto = rand(produtos);
    const corretorId = rand(corretores);
    const clienteId = rand(clientes);
    const valor = produto.tipo_comissao === 'recorrente' ? randInt(200, 1200) : randInt(1500, 8000);
    const diasVenc = randInt(-45, 120);
    const vencimento = diasFromHoje(diasVenc);
    const inicio = diasFromHoje(diasVenc - produto.vigencia_meses * 30);
    const venda = await criarVendaComComissoes(produto, valor, inicio, corretorId);

    const sorte = Math.random();
    let status = 'ativa';
    let motivo = null;
    if (sorte < 0.08) { status = 'cancelada'; motivo = rand(['preco', 'concorrencia', 'insatisfacao', 'sem_contato']); canceladas++; }
    else ativas++;

    const maeId = uuid();
    const { error } = await supabase.from('apolices').insert({
      id: maeId, tenant_id: TENANT_ID, cliente_id: clienteId, produto_id: produto.id,
      corretor_id: corretorId, venda_id: venda, valor, forma_pagamento: 'pix',
      data_inicio: inicio, data_vencimento: vencimento, status, motivo_cancelamento: motivo,
    });
    if (error) throw error;

    // ~10% renovadas: cria filha e marca a mãe como renovada
    if (status === 'ativa' && Math.random() < 0.12) {
      const vendaF = await criarVendaComComissoes(produto, valor, vencimento, corretorId);
      const novoVenc = diasFromHoje(diasVenc + produto.vigencia_meses * 30);
      const { error: ef } = await supabase.from('apolices').insert({
        id: uuid(), tenant_id: TENANT_ID, cliente_id: clienteId, produto_id: produto.id,
        corretor_id: corretorId, venda_id: vendaF, valor, forma_pagamento: 'pix',
        data_inicio: diasFromHoje(diasVenc - randInt(0, 10)), data_vencimento: novoVenc,
        status: 'ativa', apolice_mae_id: maeId,
      });
      if (ef) throw ef;
      await supabase.from('apolices').update({ status: 'renovada' }).eq('id', maeId);
      ativas--; renovadas++;
    }
  }

  console.log(`OK: 3 corretores, ${clientes.length} clientes, ${produtos.length} produtos.`);
  console.log(`Apólices: ~${ativas} ativas, ${renovadas} renovadas, ${canceladas} canceladas.`);
  console.log('Rode o recálculo de health: POST /api/jobs/recalcular-carteira (header x-job-secret).');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
