'use strict';

// Rate limiting (Redis Strings, INCR + EXPIRE — ver README/ADR). Chave por
// IP: um único endpoint de upload sob abuso não deve conseguir saturar a
// fila/worker antes mesmo do job existir.
function createRateLimitMiddleware({ rateLimiter }) {
  return async function rateLimit(req, res, next) {
    try {
      const key = `ratelimit:upload:${req.ip}`;
      const allowed = await rateLimiter.hit(key);
      if (!allowed) {
        res.status(429).json({ error: 'muitos uploads em pouco tempo, tente novamente em instantes' });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = createRateLimitMiddleware;
