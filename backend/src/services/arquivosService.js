const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const arquivosRepository = require('../repositories/arquivosRepository');
const leadsRepository = require('../repositories/leadsRepository');

const BUCKET = 'propostas';
const TIPOS = ['cotacao', 'proposta'];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

// Sobe o PDF pro bucket privado `propostas` e registra em `arquivos`.
//
// IMPORTANTE — não existe extração automática ainda: a Claude API não está
// integrada neste backend. O registro fica com status_extracao='processando'
// só porque o schema não tem um estado "aguardando processamento manual" —
// na prática nada vai processar isso sozinho hoje. O frontend precisa deixar
// isso explícito pro corretor (ver CadastroClienteModal), não fingir que a
// IA já leu o arquivo.
async function upload(tenantId, { tipo, buffer, mimeType, originalName, leadId }, usuario) {
  if (!TIPOS.includes(tipo)) {
    throw new ValidationError(`tipo inválido. Valores aceitos: ${TIPOS.join(', ')}.`);
  }
  if (!buffer || buffer.length === 0) {
    throw new ValidationError('Arquivo vazio ou ausente.');
  }
  if (buffer.length > MAX_BYTES) {
    throw new ValidationError('Arquivo maior que 10MB.');
  }
  if (mimeType !== 'application/pdf') {
    throw new ValidationError('Só é aceito arquivo PDF.');
  }

  let lead = null;
  if (leadId) {
    lead = await leadsRepository.findById(tenantId, leadId);
    if (!lead) throw new ValidationError('Lead vinculado não encontrado nesta conta.');
  }

  const path = `${tenantId}/${crypto.randomUUID()}.pdf`;
  const { error: storageError } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (storageError) {
    throw new Error(`Falha ao salvar o PDF no storage: ${storageError.message}`);
  }

  try {
    return await arquivosRepository.create(tenantId, {
      lead_id: leadId || null,
      tipo,
      storage_path: path,
      nome_original: originalName || null,
      mime_type: mimeType,
      tamanho_bytes: buffer.length,
      status_extracao: 'processando',
    });
  } catch (err) {
    // Sobe o arquivo mas falha o registro: limpa o objeto órfão no storage.
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw err;
  }
}

async function listar(tenantId, filtros = {}) {
  return arquivosRepository.list(tenantId, filtros);
}

module.exports = { upload, listar, ValidationError, TIPOS };
