'use strict';

module.exports = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  rabbitmqUrl: process.env.RABBITMQ_URL,
  redisUrl: process.env.REDIS_URL,
  storagePath: process.env.STORAGE_PATH || '/app/storage',
  transcriptionApiUrl: process.env.TRANSCRIPTION_API_URL,
  // Cache-Aside (GET /videos/:id): TTL curto + jitter mitiga Cache Stampede
  // (expirações em massa gerando pico simultâneo no Postgres); TTL do
  // marcador "não encontrado" mitiga Cache Penetration (ver README, ADR).
  cache: {
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '30', 10),
    jitterSeconds: parseInt(process.env.CACHE_JITTER_SECONDS || '10', 10),
    notFoundTtlSeconds: parseInt(process.env.CACHE_NOT_FOUND_TTL_SECONDS || '60', 10),
  },
  // Rate limiting (POST /videos): janela fixa via Redis Strings (INCR + EXPIRE).
  rateLimit: {
    windowSeconds: parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || '60', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '20', 10),
  },
  outboxRelay: {
    pollIntervalMs: parseInt(process.env.OUTBOX_POLL_INTERVAL_MS || '500', 10),
  },
};
