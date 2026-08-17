'use strict';

const ProcessingJob = require('../../domain/ProcessingJob');
const logger = require('../../infra/logger');

function createVideoJobConsumer({ processVideoUsecase }) {
  return async function handleMessage(channel, msg) {
    if (!msg) return;

    let job;
    try {
      job = ProcessingJob.parse(msg.content.toString());
    } catch (err) {
      logger.error('mensagem descartada: payload inválido', { message: err.message });
      channel.nack(msg, false, false);
      return;
    }

    try {
      await processVideoUsecase(job);
      channel.ack(msg);
    } catch (err) {
      logger.error('falha ao processar vídeo', { videoId: job.videoId, message: err.message });
      channel.nack(msg, false, false);
    }
  };
}

module.exports = createVideoJobConsumer;
