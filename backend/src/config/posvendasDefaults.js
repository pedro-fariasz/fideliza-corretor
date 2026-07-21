// =============================================================================
// posvendasDefaults — etapas e mensagens de FÁBRICA da esteira de pós-venda.
//
// Nada aqui é regra de negócio hardcoded na lógica: são só os padrões que o
// backend materializa por conta (posvendasConfigService.garantirDefaults) e que
// o corretor pode editar/desligar/reordenar depois. "Restaurar padrão" volta
// pra cá.
//
// gatilho_dias: offset em dias. Positivo = depois; negativo = antes.
//   - venda/renovacao: a partir da data de início da (nova) vigência
//   - vencimento:      a partir da data de vencimento (ex.: -60 = D-60)
//   - aniversario:     a partir do aniversário do cliente (0 = no dia)
// =============================================================================

// Categorias de pós-venda (mais amplas que produtos.categoria — decisão do brief).
const CATEGORIAS_POSVENDA = [
  'seguro',
  'saude',
  'consorcio',
  'venda_imovel',
  'locacao',
  'administracao_imoveis',
  'geral',
];

const CATEGORIA_LABEL = {
  seguro: 'Seguro',
  saude: 'Saúde',
  consorcio: 'Consórcio',
  venda_imovel: 'Venda de Imóvel',
  locacao: 'Locação',
  administracao_imoveis: 'Administração de Imóveis',
  geral: 'Geral',
};

// produtos.categoria ('consorcio'|'seguro'|'saude'|'imobiliario') -> categoria de pós-venda.
function categoriaPosvendaDeProduto(categoriaProduto) {
  switch (categoriaProduto) {
    case 'consorcio':
      return 'consorcio';
    case 'seguro':
      return 'seguro';
    case 'saude':
      return 'saude';
    case 'imobiliario':
      return 'venda_imovel';
    default:
      return 'geral';
  }
}

// Etapas de fábrica (iguais para todas as categorias; o texto da mensagem é que
// muda por categoria). Ordem = a sequência natural da esteira.
const ETAPAS_PADRAO = [
  { chave: 'boas_vindas', nome: 'Boas-vindas', ordem: 1, gatilho_tipo: 'venda', gatilho_dias: 1 },
  { chave: 'satisfacao', nome: 'Satisfação', ordem: 2, gatilho_tipo: 'venda', gatilho_dias: 30 },
  { chave: 'expansao', nome: 'Expansão', ordem: 3, gatilho_tipo: 'venda', gatilho_dias: 45 },
  { chave: 'pre_renovacao', nome: 'Pré-Renovação', ordem: 4, gatilho_tipo: 'vencimento', gatilho_dias: -60 },
  { chave: 'renovacao', nome: 'Renovação', ordem: 5, gatilho_tipo: 'vencimento', gatilho_dias: 0 },
  { chave: 'aniversario', nome: 'Aniversário', ordem: 6, gatilho_tipo: 'aniversario', gatilho_dias: 0 },
];

// Variáveis suportadas nos templates.
const VARIAVEIS = ['[NOME]', '[PRODUTO]', '[VENCIMENTO]', '[VALOR]', '[CORRETOR]'];

// Texto de fábrica por etapa. Category-agnostic no MVP da fase (o corretor
// personaliza por categoria depois); a função abaixo permite variar por
// categoria no futuro sem mudar quem chama.
const MENSAGENS_PADRAO = {
  boas_vindas:
    'Olá [NOME], aqui é [CORRETOR]! 🎉 Seja muito bem-vindo(a). Seu [PRODUTO] já está ' +
    'ativo. Qualquer dúvida, é só me chamar por aqui — estou à disposição.',
  satisfacao:
    'Oi [NOME], tudo bem? Já faz um mês do seu [PRODUTO]. Numa nota de 0 a 10, o quanto ' +
    'você recomendaria meu atendimento a um amigo? Sua resposta me ajuda muito!',
  expansao:
    'Olá [NOME]! Que bom te ter na carteira. Tenho algumas opções que combinam com o seu ' +
    'perfil e podem te proteger ainda mais. Posso te mostrar rapidinho?',
  pre_renovacao:
    'Oi [NOME], seu [PRODUTO] vence em [VENCIMENTO]. Já comecei a preparar sua renovação ' +
    'pra você não ficar sem cobertura. Podemos conversar sobre as condições?',
  renovacao:
    'Olá [NOME]! Hoje é o vencimento do seu [PRODUTO] ([VENCIMENTO]). Vamos garantir a ' +
    'renovação agora para manter tudo em dia? Me avise que já encaminho.',
  aniversario:
    'Feliz aniversário, [NOME]! 🎂 Desejo um dia incrível. Conte comigo sempre — [CORRETOR].',
};

function mensagemPadrao(_categoria, etapaChave) {
  return MENSAGENS_PADRAO[etapaChave] || '';
}

module.exports = {
  CATEGORIAS_POSVENDA,
  CATEGORIA_LABEL,
  categoriaPosvendaDeProduto,
  ETAPAS_PADRAO,
  VARIAVEIS,
  MENSAGENS_PADRAO,
  mensagemPadrao,
};
