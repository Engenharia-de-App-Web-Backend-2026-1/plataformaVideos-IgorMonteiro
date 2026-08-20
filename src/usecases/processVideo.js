'use strict';

const path = require('path');
const { STATUS } = require('../domain/Video');
const ProgressUpdate = require('../domain/ProgressUpdate');
const RESOLUTIONS = require('../domain/resolutions');

function createProcessVideo({
  videoRepository,
  videoProcessor,
  progressPublisher,
  transcriptionService,
  logger,
  storageBasePath,
}) {
  return async function processVideo({ videoId, storagePath, actions }) {
    // `actions` já chega validado pelo boundary que recebeu a mensagem
    // (ProcessingJob.parse) — o usecase só decide o que executar com base
    // nele, sem repetir a regra de negócio de "pelo menos uma ação".
    const { resolutions = [], extractAudio = false, watermark = false } = actions || {};
    const inputPath = path.join(storageBasePath, storagePath);
    const baseName = path.parse(storagePath).name;

    async function publish(stage, percent, outputPath) {
      await progressPublisher.publishProgress(
        videoId,
        ProgressUpdate.create({ videoId, stage, percent, status: STATUS.PROCESSING, outputPath }),
      );
    }

    await videoRepository.updateStatus(videoId, STATUS.PROCESSING);

    try {
      const resolutionsToProcess = RESOLUTIONS.filter((r) => resolutions.includes(r.label));

      for (const resolution of resolutionsToProcess) {
        const outputFile = `${baseName}-${resolution.label}.mp4`;
        const outputPath = path.join(storageBasePath, outputFile);
        await videoProcessor.transcode({
          inputPath,
          outputPath,
          height: resolution.height,
          watermark,
          onProgress: (percent) => publish(`convertendo_${resolution.label}`, percent),
        });
        await publish(`convertendo_${resolution.label}`, 100, outputFile);
      }

      if (extractAudio) {
        const audioFile = `${baseName}.mp3`;
        const audioPath = path.join(storageBasePath, audioFile);
        await videoProcessor.extractAudio({ inputPath, outputPath: audioPath });
        await publish('extraindo_audio', 100, audioFile);

        try {
          await transcriptionService.transcribe({ videoId, audioPath });
        } catch (err) {
          logger.warn('falha ao gerar legendagem automática, seguindo sem legendas', {
            videoId,
            message: err.message,
          });
        }
      }

      await videoRepository.updateStatus(videoId, STATUS.COMPLETED);
      await progressPublisher.publishProgress(
        videoId,
        ProgressUpdate.create({ videoId, stage: 'concluido', percent: 100, status: STATUS.COMPLETED }),
      );
    } catch (err) {
      await videoRepository.updateStatus(videoId, STATUS.FAILED);
      await progressPublisher.publishProgress(
        videoId,
        ProgressUpdate.create({ videoId, stage: 'falhou', percent: null, status: STATUS.FAILED }),
      );
      throw err;
    }
  };
}

module.exports = createProcessVideo;
