'use strict';

// Janela fixa com Strings do Redis: INCR é atômico mesmo com várias réplicas
// da API concorrendo na mesma chave, e EXPIRE só é armado no primeiro hit da
// janela (ver README, ADR "Rate limiting com Redis").
function createRedisRateLimiter({ redis, windowSeconds = 60, max = 20 }) {
  return {
    async hit(key) {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }
      return count <= max;
    },
  };
}

module.exports = createRedisRateLimiter;
