'use strict';

const path = require('path');
const { ValidationError, NotFoundError } = require('../domain/errors');
const RESOLUTIONS = require('../domain/resolutions');

// Mesma convenção de nomes usada em processVideo.js/uploadVideo.js
// (`<baseName>-<resolução>.mp4`, `<baseName>.mp3`). Só um nome que bate com
// essa convenção, para o vídeo pedido, pode ser baixado — evita tanto path
// traversal quanto acessar o arquivo de outro vídeo por adivinhação de nome.
function allowedFilenames(storagePath) {
  const baseName = path.parse(storagePath).name;
  const names = RESOLUTIONS.map((r) => `${baseName}-${r.label}.mp4`);
  names.push(`${baseName}.mp3`);
  return names;
}

function createGetVideoFile({ videoRepository }) {
  return async function getVideoFile({ videoId, filename }) {
    if (!filename || filename !== path.basename(filename)) {
      throw new ValidationError('nome de arquivo inválido');
    }

    const video = await videoRepository.findById(videoId);
    if (!video) {
      throw new NotFoundError('vídeo não encontrado');
    }

    if (!allowedFilenames(video.storagePath).includes(filename)) {
      throw new NotFoundError('arquivo não encontrado para este vídeo');
    }

    return { filename };
  };
}

module.exports = createGetVideoFile;
