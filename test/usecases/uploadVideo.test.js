'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const createUploadVideo = require('../../src/usecases/uploadVideo');
const { ValidationError } = require('../../src/domain/errors');

function createMocks() {
  const savedWithJob = [];

  return {
    videoRepository: {
      async saveWithJob(video, job) {
        savedWithJob.push({ video, job });
      },
    },
    savedWithJob,
  };
}

test('salva o vídeo e o job na outbox, atomicamente, com as ações escolhidas', async () => {
  const { videoRepository, savedWithJob } = createMocks();
  const uploadVideo = createUploadVideo({ videoRepository });

  const result = await uploadVideo({
    originalFilename: 'aula.mp4',
    storagePath: '123-aula.mp4',
    actions: { resolutions: ['720p'], extractAudio: true, watermark: true },
  });

  assert.equal(savedWithJob.length, 1);
  assert.equal(savedWithJob[0].video.id, result.video.id);
  assert.deepEqual(savedWithJob[0].job, {
    videoId: result.video.id,
    storagePath: result.video.storagePath,
    actions: { resolutions: ['720p'], extractAudio: true, watermark: true },
  });
});

test('rejeita quando nenhuma ação foi selecionada e não grava nada', async () => {
  const { videoRepository, savedWithJob } = createMocks();
  const uploadVideo = createUploadVideo({ videoRepository });

  await assert.rejects(
    () => uploadVideo({ originalFilename: 'aula.mp4', storagePath: '123-aula.mp4', actions: {} }),
    ValidationError,
  );
  assert.equal(savedWithJob.length, 0);
});

test('não grava nada se a validação do domínio falhar', async () => {
  const { videoRepository, savedWithJob } = createMocks();
  const uploadVideo = createUploadVideo({ videoRepository });

  await assert.rejects(
    () => uploadVideo({ storagePath: '123-aula.mp4', actions: { extractAudio: true } }),
    ValidationError,
  );
  assert.equal(savedWithJob.length, 0);
});

test('propaga erro do repositório (ex.: transação da outbox falhou)', async () => {
  const videoRepository = {
    async saveWithJob() {
      throw new Error('falha de conexão com o banco');
    },
  };
  const uploadVideo = createUploadVideo({ videoRepository });

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
  const { videoRepository } = createMocks();
  const uploadVideo = createUploadVideo({ videoRepository });

  const result = await uploadVideo({
    originalFilename: 'aula.mp4',
    storagePath: '123-aula.mp4',
    actions: { resolutions: ['360p', '720p'], extractAudio: true },
  });

  assert.deepEqual(result.plannedOutputs, ['123-aula-360p.mp4', '123-aula-720p.mp4', '123-aula.mp3']);
});
