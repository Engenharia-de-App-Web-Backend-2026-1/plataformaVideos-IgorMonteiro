'use strict';

// Marcador de "sabidamente não existe" (Cache Penetration): sem isso, um
// videoId inválido nunca teria cache hit e bateria no Postgres a cada
// requisição — inclusive sob abuso intencional (ver README, ADR "Cache-Aside").
const NOT_FOUND_MARKER = '__NOT_FOUND__';

function cacheKey(videoId) {
  return `cache:video:${videoId}`;
}

function createRedisVideoCache({ redis, ttlSeconds = 30, jitterSeconds = 10, notFoundTtlSeconds = 60 }) {
  return {
    // Retorno de três estados: undefined = cache miss (nunca visto);
    // null = miss "negativo" já cacheado (vídeo não existe); objeto = hit.
    async get(videoId) {
      const raw = await redis.get(cacheKey(videoId));
      if (raw === null) return undefined;
      if (raw === NOT_FOUND_MARKER) return null;
      return JSON.parse(raw);
    },

    // Jitter no TTL espalha as expirações no tempo: sem ele, todo vídeo
    // cacheado no mesmo instante expiraria junto, e uma rajada de leituras
    // simultâneas cairia toda de uma vez no Postgres (Cache Stampede).
    async set(videoId, video) {
      const jitter = Math.floor(Math.random() * jitterSeconds);
      await redis.set(cacheKey(videoId), JSON.stringify(video), 'EX', ttlSeconds + jitter);
    },

    async setNotFound(videoId) {
      await redis.set(cacheKey(videoId), NOT_FOUND_MARKER, 'EX', notFoundTtlSeconds);
    },
  };
}

module.exports = createRedisVideoCache;
