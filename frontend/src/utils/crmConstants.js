// Constantes de domínio do CRM — espelham os enums do backend (migrations 006–008).

export const ESTAGIOS = [
  { value: 'prospectos', label: 'Prospectos' },
  { value: 'qualificados', label: 'Qualificados' },
  { value: 'proposta_enviada', label: 'Proposta Enviada' },
  { value: 'negociacao', label: 'Negociação' },
  { value: 'finalizacao', label: 'Finalização' },
  { value: 'venda_concluida', label: 'Venda Concluída' },
];

export const ESTAGIO_LABEL = ESTAGIOS.reduce((acc, e) => {
  acc[e.value] = e.label;
  return acc;
}, {});

export const CATEGORIAS = [
  { value: 'consorcio', label: 'Consórcio' },
  { value: 'seguro', label: 'Seguro' },
  { value: 'saude', label: 'Plano de Saúde' },
  { value: 'imobiliario', label: 'Imobiliário' },
];

// Vertical única = plano de saúde. Substitui `categoria` no app (migration 016).
export const TIPOS_PLANO_SAUDE = [
  { value: 'PF', label: 'PF (Pessoa Física)' },
  { value: 'PME', label: 'PME' },
  { value: 'Adesao', label: 'Adesão' },
  { value: 'PJ', label: 'PJ (Pessoa Jurídica)' },
  { value: 'Odontologico', label: 'Odontológico' },
];

// Rótulo curto do tipo do plano (usado na lista/coluna "Tipo").
export const TIPO_PLANO_SAUDE_LABEL = TIPOS_PLANO_SAUDE.reduce((a, t) => ((a[t.value] = t.label), a), {});

export const INTERESSES = [
  { value: 'consorcio', label: 'Consórcio' },
  { value: 'seguro', label: 'Seguro' },
  { value: 'imovel', label: 'Imóvel' },
  { value: 'saude', label: 'Plano de Saúde' },
];

// Lista granular de origem específica (PRD Apêndice B) — alimenta o BI futuro.
export const ORIGENS = [
  'Instagram',
  'Facebook/Meta Ads',
  'Google Ads',
  'YouTube',
  'TikTok',
  'LinkedIn',
  'WhatsApp',
  'E-mail Marketing',
  'Site/Landing Page',
  'Indicação de Cliente',
  'Indicação de Parceiro',
  'Indicação de Corretor',
  'Ligação Ativa',
  'Abordagem Presencial',
  'Evento/Feira',
  'Panfleto',
  'Empresa Parceira',
  'RH/Benefícios',
  'Sindicato/Associação',
  'Carteira Antiga',
  'Reativação de Lead',
].map((o) => ({ value: o, label: o }));

export const FORMAS_PAGAMENTO = [
  { value: 'debito', label: 'Débito em conta' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'pix', label: 'Pix' },
  { value: 'cartao', label: 'Cartão de Crédito' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'outro', label: 'Outro' },
];
