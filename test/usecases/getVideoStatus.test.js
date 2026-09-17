'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const createGetVideoStatus = require('../../src/usecases/getVideoStatus');
const { NotFoundError } = require('../../src/domain/errors');

function createMocks({ video, cached } = {}) {
  const cacheStore = new Map();
  if (cached !== undefined) {
    cacheStore.set('v1', cached);
  }

  const findByIdCalls = [];
  const setCalls = [];
  const setNotFoundCalls = [];

  return {
    videoRepository: {
      async findById(id) {
        findByIdCalls.push(id);
        return video && video.id === id ? video : null;
      },
    },
    videoCache: {
      async get(id) {
        return cacheStore.has(id) ? cacheStore.get(id) : undefined;
      },
      async set(id, v) {
        setCalls.push({ id, v });
        cacheStore.set(id, v);
      },
      async setNotFound(id) {
        setNotFoundCalls.push(id);
        cacheStore.set(id, null);
      },
    },
    findByIdCalls,
    setCalls,
    setNotFoundCalls,
  };
}

test('cache hit: retorna do cache sem consultar o repositório', async () => {
  const video = { id: 'v1', status: 'processing' };
  const mocks = createMocks({ cached: video });
  const getVideoStatus = createGetVideoStatus(mocks);

  const result = await getVideoStatus({ videoId: 'v1' });

  assert.deepEqual(result, video);
  assert.equal(mocks.findByIdCalls.length, 0);
});

test('cache miss + encontrado: busca no repositório e popula o cache (cache-aside)', async () => {
  const video = { id: 'v1', status: 'completed' };
  const mocks = createMocks({ video });
  const getVideoStatus = createGetVideoStatus(mocks);

  const result = await getVideoStatus({ videoId: 'v1' });

  assert.deepEqual(result, video);
  assert.equal(mocks.findByIdCalls.length, 1);
  assert.deepEqual(mocks.setCalls, [{ id: 'v1', v: video }]);
});

test('cache miss + não encontrado: cacheia o "não encontrado" (mitigação de cache penetration)', async () => {
  const mocks = createMocks({ video: null });
  const getVideoStatus = createGetVideoStatus(mocks);

  await assert.rejects(() => getVideoStatus({ videoId: 'inexistente' }), NotFoundError);
  assert.deepEqual(mocks.setNotFoundCalls, ['inexistente']);
});

test('marcador de "não encontrado" já cacheado: rejeita sem consultar o repositório de novo', async () => {
  const mocks = createMocks({ cached: null });
  const getVideoStatus = createGetVideoStatus(mocks);

  await assert.rejects(() => getVideoStatus({ videoId: 'v1' }), NotFoundError);
  assert.equal(mocks.findByIdCalls.length, 0);
});
