'use strict';

const { ValidationError } = require('./errors');
const ProcessingActions = require('./processingActions');

function parse(rawMessage) {
  let data;
  try {
    data = JSON.parse(rawMessage);
  } catch (err) {
    throw new ValidationError('mensagem AMQP inválida: JSON malformado');
  }

  if (!data.videoId || !data.storagePath) {
    throw new ValidationError('mensagem AMQP inválida: videoId e storagePath são obrigatórios');
  }

  const actions = ProcessingActions.parse(data.actions || {});

  return { videoId: data.videoId, storagePath: data.storagePath, actions };
}

module.exports = { parse };
