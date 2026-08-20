'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const createProcessVideo = require('../../src/usecases/processVideo');
const { STATUS } = require('../../src/domain/Video');

const ALL_ACTIONS = { resolutions: ['360p', '720p', '1080p'], extractAudio: true, watermark: true };

function createMocks({ transcodeFails = false, transcribeFails = false } = {}) {
  const statusUpdates = [];
  const progressUpdates = [];
  const transcodeCalls = [];
  const extractAudioCalls = [];
  const warnings = [];

  return {
    videoRepository: {
      async updateStatus(id, status) {
        statusUpdates.push({ id, status });
      },
    },
    videoProcessor: {
      async transcode({ height, watermark, onProgress }) {
        transcodeCalls.push({ height, watermark });
        if (transcodeFails) throw new Error('ffmpeg explodiu');
        onProgress(50);
        onProgress(100);
      },
      async extractAudio() {
        extractAudioCalls.push(true);
      },
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
    extractAudioCalls,
    warnings,
  };
}

test('processa vídeo com sucesso: 3 resoluções, áudio, transcrição e status final concluído', async () => {
  const mocks = createMocks();
  const processVideo = createProcessVideo(mocks);

  await processVideo({ videoId: 'v1', storagePath: 'video.mp4', actions: ALL_ACTIONS });

  assert.deepEqual(
    mocks.transcodeCalls.map((c) => c.height),
    [360, 720, 1080],
  );
  assert.equal(mocks.extractAudioCalls.length, 1);
  assert.deepEqual(mocks.statusUpdates, [
    { id: 'v1', status: STATUS.PROCESSING },
    { id: 'v1', status: STATUS.COMPLETED },
  ]);

  const finalUpdate = mocks.progressUpdates[mocks.progressUpdates.length - 1];
  assert.equal(finalUpdate.status, STATUS.COMPLETED);
  assert.equal(finalUpdate.percent, 100);
  assert.equal(mocks.warnings.length, 0);
});

test('só executa as ações selecionadas: apenas 720p, sem áudio e sem marca d\'água', async () => {
  const mocks = createMocks();
  const processVideo = createProcessVideo(mocks);

  await processVideo({
    videoId: 'v1',
    storagePath: 'video.mp4',
    actions: { resolutions: ['720p'], extractAudio: false, watermark: false },
  });

  assert.deepEqual(mocks.transcodeCalls, [{ height: 720, watermark: false }]);
  assert.equal(mocks.extractAudioCalls.length, 0);
});

test('extração de áudio sozinha não gera nenhuma conversão de resolução', async () => {
  const mocks = createMocks();
  const processVideo = createProcessVideo(mocks);

  await processVideo({
    videoId: 'v1',
    storagePath: 'video.mp4',
    actions: { resolutions: [], extractAudio: true, watermark: false },
  });

  assert.equal(mocks.transcodeCalls.length, 0);
  assert.equal(mocks.extractAudioCalls.length, 1);
});

test('publica o outputPath (destino do arquivo) ao concluir cada etapa', async () => {
  const mocks = createMocks();
  const processVideo = createProcessVideo(mocks);

  await processVideo({
    videoId: 'v1',
    storagePath: 'video.mp4',
    actions: { resolutions: ['720p'], extractAudio: true, watermark: false },
  });

  const conversionDone = mocks.progressUpdates.find(
    (u) => u.stage === 'convertendo_720p' && u.percent === 100 && u.outputPath,
  );
  const audioDone = mocks.progressUpdates.find((u) => u.stage === 'extraindo_audio');

  assert.equal(conversionDone.outputPath, 'video-720p.mp4');
  assert.equal(audioDone.outputPath, 'video.mp3');
});

test('falha na transcrição é best-effort: não falha o job, mas gera aviso no log', async () => {
  const mocks = createMocks({ transcribeFails: true });
  const processVideo = createProcessVideo(mocks);

  await processVideo({ videoId: 'v1', storagePath: 'video.mp4', actions: ALL_ACTIONS });

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
    () => processVideo({ videoId: 'v1', storagePath: 'video.mp4', actions: ALL_ACTIONS }),
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

  await processVideo({ videoId: 'v1', storagePath: 'video.mp4', actions: ALL_ACTIONS });

  const stage360 = mocks.progressUpdates.filter((u) => u.stage === 'convertendo_360p');
  assert.deepEqual(stage360.map((u) => u.percent), [50, 100, 100]);
});
