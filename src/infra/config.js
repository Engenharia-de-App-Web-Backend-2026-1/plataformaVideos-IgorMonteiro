'use strict';

module.exports = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  rabbitmqUrl: process.env.RABBITMQ_URL,
  redisUrl: process.env.REDIS_URL,
  storagePath: process.env.STORAGE_PATH || '/app/storage',
  transcriptionApiUrl: process.env.TRANSCRIPTION_API_URL,
};
