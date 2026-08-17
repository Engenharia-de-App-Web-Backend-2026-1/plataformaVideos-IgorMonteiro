'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const createUploadVideo = require('../../src/usecases/uploadVideo');
const { ValidationError } = require('../../src/domain/errors');

function createMocks() {
  const saved = [];
  const published = [];

  return {
    videoRepository: {
      async save(video) {
        saved.push(video);
      },
    },
    jobPublisher: {
      async publishVideoJob(job) {
        published.push(job);
      },
    },
    saved,
    published,
  };
}

test('salva o vídeo e publica o job na fila', async () => {
  const { videoRepository, jobPublisher, saved, published } = createMocks();
  const uploadVideo = createUploadVideo({ videoRepository, jobPublisher });

  const video = await uploadVideo({ originalFilename: 'aula.mp4', storagePath: '123-aula.mp4' });

  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, video.id);
  assert.equal(published.length, 1);
  assert.deepEqual(published[0], { videoId: video.id, storagePath: video.storagePath });
});

test('não publica job se a validação do domínio falhar', async () => {
  const { videoRepository, jobPublisher, saved, published } = createMocks();
  const uploadVideo = createUploadVideo({ videoRepository, jobPublisher });

  await assert.rejects(
    () => uploadVideo({ storagePath: '123-aula.mp4' }),
    ValidationError,
  );
  assert.equal(saved.length, 0);
  assert.equal(published.length, 0);
});

test('propaga erro do repositório sem publicar job', async () => {
  const jobPublisher = { async publishVideoJob() { throw new Error('não deveria ser chamado'); } };
  const videoRepository = {
    async save() {
      throw new Error('falha de conexão com o banco');
    },
  };
  const uploadVideo = createUploadVideo({ videoRepository, jobPublisher });

  await assert.rejects(
    () => uploadVideo({ originalFilename: 'aula.mp4', storagePath: '123-aula.mp4' }),
    /falha de conexão com o banco/,
  );
});
