'use strict';

const { ValidationError } = require('./errors');
const RESOLUTIONS = require('./resolutions');

const VALID_LABELS = RESOLUTIONS.map((r) => r.label);

function toBoolean(value) {
  return value === true || value === 'true' || value === 'on' || value === '1';
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

// O usuário escolhe cada ação individualmente (nenhuma resolução, extração de
// áudio ou marca d'água é aplicada "de graça"). Regra invariante: precisa
// sobrar pelo menos uma ação que gere algum arquivo de saída — senão o job
// não faria nada.
function parse(raw = {}) {
  const resolutions = toArray(raw.resolutions).filter((label) => VALID_LABELS.includes(label));
  const extractAudio = toBoolean(raw.extractAudio);
  const watermark = toBoolean(raw.watermark);

  if (resolutions.length === 0 && !extractAudio) {
    throw new ValidationError(
      'selecione ao menos uma ação: uma resolução para converter ou a extração de áudio',
    );
  }

  return {
    resolutions,
    extractAudio,
    // marca d'água é um modificador da conversão de vídeo: sem nenhuma
    // resolução selecionada, não existe em cima do que aplicá-la.
    watermark: watermark && resolutions.length > 0,
  };
}

module.exports = { parse };
