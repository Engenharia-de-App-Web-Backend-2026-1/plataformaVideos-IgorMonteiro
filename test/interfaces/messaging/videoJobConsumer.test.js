'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const createVideoJobConsumer = require('../../../src/interfaces/messaging/videoJobConsumer');

function fakeMessage(payload) {
  return { content: Buffer.from(JSON.stringify(payload)) };
}

function createFakeChannel() {
  const acked = [];
  const nacked = [];
  return {
    ack(msg) {
      acked.push(msg);
    },
    nack(msg, allUpTo, requeue) {
      nacked.push({ msg, allUpTo, requeue });
    },
    acked,
    nacked,
  };
}

test('processa a mensagem e dá ack quando o usecase tem sucesso', async () => {
  const calls = [];
  const processVideoUsecase = async (job) => {
    calls.push(job);
  };
  const handleMessage = createVideoJobConsumer({ processVideoUsecase });
  const channel = createFakeChannel();
  const msg = fakeMessage({
    videoId: 'v1',
    storagePath: 'v1.mp4',
    actions: { resolutions: ['720p'], extractAudio: false, watermark: false },
  });

  await handleMessage(channel, msg);

  assert.deepEqual(calls, [
    {
      videoId: 'v1',
      storagePath: 'v1.mp4',
      actions: { resolutions: ['720p'], extractAudio: false, watermark: false },
    },
  ]);
  assert.equal(channel.acked.length, 1);
  assert.equal(channel.nacked.length, 0);
});

test('descarta (nack sem requeue) mensagem sem nenhuma ação selecionada', async () => {
  let called = false;
  const processVideoUsecase = async () => {
    called = true;
  };
  const handleMessage = createVideoJobConsumer({ processVideoUsecase });
  const channel = createFakeChannel();
  const msg = fakeMessage({ videoId: 'v1', storagePath: 'v1.mp4' });

  await handleMessage(channel, msg);

  assert.equal(called, false);
  assert.equal(channel.nacked.length, 1);
  assert.equal(channel.nacked[0].requeue, false);
});

test('descarta (nack sem requeue) mensagem com JSON inválido, sem chamar o usecase', async () => {
  let called = false;
  const processVideoUsecase = async () => {
    called = true;
  };
  const handleMessage = createVideoJobConsumer({ processVideoUsecase });
  const channel = createFakeChannel();
  const msg = { content: Buffer.from('{not json') };

  await handleMessage(channel, msg);

  assert.equal(called, false);
  assert.equal(channel.nacked.length, 1);
  assert.equal(channel.nacked[0].requeue, false);
});

test('dá nack sem requeue quando o usecase lança erro', async () => {
  const processVideoUsecase = async () => {
    throw new Error('ffmpeg indisponível');
  };
  const handleMessage = createVideoJobConsumer({ processVideoUsecase });
  const channel = createFakeChannel();
  const msg = fakeMessage({
    videoId: 'v1',
    storagePath: 'v1.mp4',
    actions: { resolutions: ['720p'], extractAudio: false, watermark: false },
  });

  await handleMessage(channel, msg);

  assert.equal(channel.acked.length, 0);
  assert.equal(channel.nacked.length, 1);
  assert.equal(channel.nacked[0].requeue, false);
});

test('ignora mensagem nula (cancelamento de consumo pelo RabbitMQ)', async () => {
  let called = false;
  const processVideoUsecase = async () => {
    called = true;
  };
  const handleMessage = createVideoJobConsumer({ processVideoUsecase });
  const channel = createFakeChannel();

  await handleMessage(channel, null);

  assert.equal(called, false);
  assert.equal(channel.acked.length, 0);
  assert.equal(channel.nacked.length, 0);
});
