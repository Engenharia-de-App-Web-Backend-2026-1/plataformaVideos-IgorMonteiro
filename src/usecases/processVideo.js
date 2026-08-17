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
  return async function processVideo({ videoId, storagePath }) {
    const inputPath = path.join(storageBasePath, storagePath);
    const baseName = path.parse(storagePath).name;

    async function publish(stage, percent) {
      await progressPublisher.publishProgress(
        videoId,
        ProgressUpdate.create({ videoId, stage, percent, status: STATUS.PROCESSING }),
      );
    }

    await videoRepository.updateStatus(videoId, STATUS.PROCESSING);

    try {
      for (const resolution of RESOLUTIONS) {
        const outputPath = path.join(storageBasePath, `${baseName}-${resolution.label}.mp4`);
        await videoProcessor.transcode({
          inputPath,
          outputPath,
          height: resolution.height,
          onProgress: (percent) => publish(`convertendo_${resolution.label}`, percent),
        });
        await publish(`convertendo_${resolution.label}`, 100);
      }

      const audioPath = path.join(storageBasePath, `${baseName}.mp3`);
      await videoProcessor.extractAudio({ inputPath, outputPath: audioPath });
      await publish('extraindo_audio', 100);

      try {
        await transcriptionService.transcribe({ videoId, audioPath });
      } catch (err) {
        logger.warn('falha ao gerar legendagem automática, seguindo sem legendas', {
          videoId,
          message: err.message,
        });
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
