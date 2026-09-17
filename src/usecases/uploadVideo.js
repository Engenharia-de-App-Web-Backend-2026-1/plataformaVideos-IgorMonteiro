'use strict';

const path = require('path');
const Video = require('../domain/Video');
const ProcessingActions = require('../domain/processingActions');
const RESOLUTIONS = require('../domain/resolutions');

// Nomes de arquivo que o worker vai gerar, na mesma convenção usada em
// usecases/processVideo.js (`<baseName>-<resolução>.mp4`, `<baseName>.mp3`).
// Serve só para avisar o cliente onde o resultado vai parar — o worker é
// quem efetivamente escreve os arquivos.
function plannedOutputFiles(storagePath, actions) {
  const baseName = path.parse(storagePath).name;
  const files = RESOLUTIONS.filter((r) => actions.resolutions.includes(r.label)).map(
    (r) => `${baseName}-${r.label}.mp4`,
  );

  if (actions.extractAudio) {
    files.push(`${baseName}.mp3`);
  }

  return files;
}

function createUploadVideo({ videoRepository }) {
  return async function uploadVideo({ originalFilename, storagePath, actions }) {
    const video = Video.create({ originalFilename, storagePath });
    const parsedActions = ProcessingActions.parse(actions || {});

    // Grava o vídeo e enfileira o job na mesma transação (Transactional
    // Outbox) — sem isso, uma falha entre "gravar no banco" e "publicar na
    // fila" perderia o job silenciosamente (Dual-Write, ver README/ADR).
    // O usecase não sabe que existe uma tabela outbox ou um broker AMQP por
    // trás disso: só chama um método com nome de domínio no repositório.
    await videoRepository.saveWithJob(video, {
      videoId: video.id,
      storagePath: video.storagePath,
      actions: parsedActions,
    });

    return {
      video,
      actions: parsedActions,
      plannedOutputs: plannedOutputFiles(video.storagePath, parsedActions),
    };
  };
}

module.exports = createUploadVideo;
