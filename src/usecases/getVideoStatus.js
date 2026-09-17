'use strict';

const { NotFoundError } = require('../domain/errors');

// Cache-Aside (Lazy Loading): consulta o cache primeiro; em miss, busca no
// repositório, popula o cache e segue. Inclui a mitigação de Cache
// Penetration (cacheia também o "não encontrado" por um TTL curto, para não
// bater no Postgres a cada tentativa de ler um videoId inválido).
function createGetVideoStatus({ videoRepository, videoCache }) {
  return async function getVideoStatus({ videoId }) {
    const cached = await videoCache.get(videoId);
    if (cached !== undefined) {
      if (cached === null) {
        throw new NotFoundError('vídeo não encontrado');
      }
      return cached;
    }

    const video = await videoRepository.findById(videoId);
    if (!video) {
      await videoCache.setNotFound(videoId);
      throw new NotFoundError('vídeo não encontrado');
    }

    await videoCache.set(videoId, video);
    return video;
  };
}

module.exports = createGetVideoStatus;
