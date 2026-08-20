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

function createUploadVideo({ videoRepository, jobPublisher }) {
  return async function uploadVideo({ originalFilename, storagePath, actions }) {
    const video = Video.create({ originalFilename, storagePath });
    const parsedActions = ProcessingActions.parse(actions || {});

    await videoRepository.save(video);
    await jobPublisher.publishVideoJob({
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
