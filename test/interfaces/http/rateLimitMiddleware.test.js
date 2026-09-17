'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const createRateLimitMiddleware = require('../../../src/interfaces/http/rateLimitMiddleware');

function createRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('libera a requisição quando o rate limiter permite', async () => {
  const rateLimiter = { async hit() { return true; } };
  const middleware = createRateLimitMiddleware({ rateLimiter });
  const req = { ip: '10.0.0.1' };
  const res = createRes();
  let nextCalled = false;

  await middleware(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test('responde 429 sem chamar next quando o rate limiter bloqueia', async () => {
  const rateLimiter = { async hit() { return false; } };
  const middleware = createRateLimitMiddleware({ rateLimiter });
  const req = { ip: '10.0.0.1' };
  const res = createRes();
  let nextCalled = false;

  await middleware(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 429);
  assert.ok(res.body.error);
});

test('chaveia o limite por IP do requisitante', async () => {
  const keys = [];
  const rateLimiter = {
    async hit(key) {
      keys.push(key);
      return true;
    },
  };
  const middleware = createRateLimitMiddleware({ rateLimiter });
  const res = createRes();

  await middleware({ ip: '10.0.0.1' }, res, () => {});
  await middleware({ ip: '10.0.0.2' }, res, () => {});

  assert.equal(keys[0], 'ratelimit:upload:10.0.0.1');
  assert.equal(keys[1], 'ratelimit:upload:10.0.0.2');
});

test('encaminha erro do rate limiter para o next (error handler)', async () => {
  const rateLimiter = { async hit() { throw new Error('redis indisponível'); } };
  const middleware = createRateLimitMiddleware({ rateLimiter });
  const req = { ip: '10.0.0.1' };
  const res = createRes();
  let forwardedErr = null;

  await middleware(req, res, (err) => { forwardedErr = err; });

  assert.ok(forwardedErr);
  assert.match(forwardedErr.message, /redis indisponível/);
});
