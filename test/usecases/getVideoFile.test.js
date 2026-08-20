'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const createGetVideoFile = require('../../src/usecases/getVideoFile');
const { ValidationError, NotFoundError } = require('../../src/domain/errors');

function createMocks(video) {
  return {
    videoRepository: {
      async findById(id) {
        return video && video.id === id ? video : null;
      },
    },
  };
}

test('libera o download de um arquivo gerado a partir do storagePath do vídeo', async () => {
  const video = { id: 'v1', storagePath: '123-aula.mp4' };
  const getVideoFile = createGetVideoFile(createMocks(video));

  const result = await getVideoFile({ videoId: 'v1', filename: '123-aula-720p.mp4' });

  assert.deepEqual(result, { filename: '123-aula-720p.mp4' });
});

test('rejeita nome de arquivo com tentativa de path traversal', async () => {
  const video = { id: 'v1', storagePath: '123-aula.mp4' };
  const getVideoFile = createGetVideoFile(createMocks(video));

  await assert.rejects(
    () => getVideoFile({ videoId: 'v1', filename: '../../etc/passwd' }),
    ValidationError,
  );
});

test('rejeita quando o vídeo não existe', async () => {
  const getVideoFile = createGetVideoFile(createMocks(null));

  await assert.rejects(
    () => getVideoFile({ videoId: 'inexistente', filename: 'qualquer.mp4' }),
    NotFoundError,
  );
});

test('rejeita arquivo que não pertence à convenção de nomes deste vídeo', async () => {
  const video = { id: 'v1', storagePath: '123-aula.mp4' };
  const getVideoFile = createGetVideoFile(createMocks(video));

  await assert.rejects(
    () => getVideoFile({ videoId: 'v1', filename: '999-outro-video-720p.mp4' }),
    NotFoundError,
  );
});
