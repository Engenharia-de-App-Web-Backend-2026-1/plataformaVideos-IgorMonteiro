'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const createProcessVideo = require('../../src/usecases/processVideo');
const { STATUS } = require('../../src/domain/Video');

function createMocks({ transcodeFails = false, transcribeFails = false } = {}) {
  const statusUpdates = [];
  const progressUpdates = [];
  const transcodeCalls = [];
  const warnings = [];

  return {
    videoRepository: {
      async updateStatus(id, status) {
        statusUpdates.push({ id, status });
      },
    },
    videoProcessor: {
      async transcode({ height, onProgress }) {
        transcodeCalls.push(height);
        if (transcodeFails) throw new Error('ffmpeg explodiu');
        onProgress(50);
        onProgress(100);
      },
      async extractAudio() {},
    },
    progressPublisher: {
      async publishProgress(videoId, update) {
        progressUpdates.push(update);
      },
    },
    transcriptionService: {
      async transcribe() {
        if (transcribeFails) throw new Error('serviço de legendagem indisponível');
      },
    },
    logger: {
      info() {},
      warn(message, meta) {
        warnings.push({ message, meta });
      },
      error() {},
    },
    storageBasePath: '/app/storage',
    statusUpdates,
    progressUpdates,
    transcodeCalls,
    warnings,
  };
}

test('processa vídeo com sucesso: 3 resoluções, áudio, transcrição e status final concluído', async () => {
  const mocks = createMocks();
  const processVideo = createProcessVideo(mocks);

  await processVideo({ videoId: 'v1', storagePath: 'video.mp4' });

  assert.deepEqual(mocks.transcodeCalls, [360, 720, 1080]);
  assert.deepEqual(mocks.statusUpdates, [
    { id: 'v1', status: STATUS.PROCESSING },
    { id: 'v1', status: STATUS.COMPLETED },
  ]);

  const finalUpdate = mocks.progressUpdates[mocks.progressUpdates.length - 1];
  assert.equal(finalUpdate.status, STATUS.COMPLETED);
  assert.equal(finalUpdate.percent, 100);
  assert.equal(mocks.warnings.length, 0);
});

test('falha na transcrição é best-effort: não falha o job, mas gera aviso no log', async () => {
  const mocks = createMocks({ transcribeFails: true });
  const processVideo = createProcessVideo(mocks);

  await processVideo({ videoId: 'v1', storagePath: 'video.mp4' });

  assert.equal(mocks.warnings.length, 1);
  assert.match(mocks.warnings[0].message, /legendagem/);
  assert.deepEqual(mocks.statusUpdates[mocks.statusUpdates.length - 1], {
    id: 'v1',
    status: STATUS.COMPLETED,
  });
});

test('falha no ffmpeg marca vídeo como failed, publica atualização e propaga o erro', async () => {
  const mocks = createMocks({ transcodeFails: true });
  const processVideo = createProcessVideo(mocks);

  await assert.rejects(
    () => processVideo({ videoId: 'v1', storagePath: 'video.mp4' }),
    /ffmpeg explodiu/,
  );

  assert.deepEqual(mocks.statusUpdates, [
    { id: 'v1', status: STATUS.PROCESSING },
    { id: 'v1', status: STATUS.FAILED },
  ]);

  const finalUpdate = mocks.progressUpdates[mocks.progressUpdates.length - 1];
  assert.equal(finalUpdate.status, STATUS.FAILED);
  assert.equal(finalUpdate.percent, null);
});

test('publica progresso real do ffmpeg (não sintético) durante a conversão', async () => {
  const mocks = createMocks();
  const processVideo = createProcessVideo(mocks);

  await processVideo({ videoId: 'v1', storagePath: 'video.mp4' });

  const stage360 = mocks.progressUpdates.filter((u) => u.stage === 'convertendo_360p');
  assert.deepEqual(stage360.map((u) => u.percent), [50, 100, 100]);
});
