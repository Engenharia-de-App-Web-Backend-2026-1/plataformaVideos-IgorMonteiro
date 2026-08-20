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

test('salva o vídeo e publica o job na fila com as ações escolhidas', async () => {
  const { videoRepository, jobPublisher, saved, published } = createMocks();
  const uploadVideo = createUploadVideo({ videoRepository, jobPublisher });

  const result = await uploadVideo({
    originalFilename: 'aula.mp4',
    storagePath: '123-aula.mp4',
    actions: { resolutions: ['720p'], extractAudio: true, watermark: true },
  });

  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, result.video.id);
  assert.equal(published.length, 1);
  assert.deepEqual(published[0], {
    videoId: result.video.id,
    storagePath: result.video.storagePath,
    actions: { resolutions: ['720p'], extractAudio: true, watermark: true },
  });
});

test('rejeita quando nenhuma ação foi selecionada e não publica job', async () => {
  const { videoRepository, jobPublisher, saved, published } = createMocks();
  const uploadVideo = createUploadVideo({ videoRepository, jobPublisher });

  await assert.rejects(
    () => uploadVideo({ originalFilename: 'aula.mp4', storagePath: '123-aula.mp4', actions: {} }),
    ValidationError,
  );
  assert.equal(saved.length, 0);
  assert.equal(published.length, 0);
});

test('não publica job se a validação do domínio falhar', async () => {
  const { videoRepository, jobPublisher, saved, published } = createMocks();
  const uploadVideo = createUploadVideo({ videoRepository, jobPublisher });

  await assert.rejects(
    () => uploadVideo({ storagePath: '123-aula.mp4', actions: { extractAudio: true } }),
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
    () =>
      uploadVideo({
        originalFilename: 'aula.mp4',
        storagePath: '123-aula.mp4',
        actions: { extractAudio: true },
      }),
    /falha de conexão com o banco/,
  );
});

test('monta a prévia dos arquivos de destino a partir das ações escolhidas', async () => {
  const { videoRepository, jobPublisher } = createMocks();
  const uploadVideo = createUploadVideo({ videoRepository, jobPublisher });

  const result = await uploadVideo({
    originalFilename: 'aula.mp4',
    storagePath: '123-aula.mp4',
    actions: { resolutions: ['360p', '720p'], extractAudio: true },
  });

  assert.deepEqual(result.plannedOutputs, ['123-aula-360p.mp4', '123-aula-720p.mp4', '123-aula.mp3']);
});
