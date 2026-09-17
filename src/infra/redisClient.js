'use strict';

const Redis = require('ioredis');
const config = require('./config');

// Instância de propósito geral (GET/SET/INCR/EXPIRE). Nunca compartilhar com
// o subscriber do SSE: uma conexão ioredis em modo `subscribe` não aceita
// mais nenhum outro comando (ver CLAUDE.md, "Armadilhas conhecidas").
function createRedisClient() {
  return new Redis(config.redisUrl);
}

module.exports = createRedisClient;
