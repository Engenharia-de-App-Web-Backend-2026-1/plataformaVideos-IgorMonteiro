'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ProcessingJob = require('../../src/domain/ProcessingJob');
const { ValidationError } = require('../../src/domain/errors');

test('faz parse de uma mensagem AMQP válida, com as ações já validadas', () => {
  const job = ProcessingJob.parse(
    JSON.stringify({
      videoId: 'abc',
      storagePath: 'abc.mp4',
      actions: { resolutions: ['720p'], extractAudio: true, watermark: true },
    }),
  );

  assert.deepEqual(job, {
    videoId: 'abc',
    storagePath: 'abc.mp4',
    actions: { resolutions: ['720p'], extractAudio: true, watermark: true },
  });
});

test('rejeita JSON malformado', () => {
  assert.throws(() => ProcessingJob.parse('{not json'), ValidationError);
});

test('rejeita mensagem sem videoId ou storagePath', () => {
  assert.throws(() => ProcessingJob.parse(JSON.stringify({ videoId: 'abc' })), ValidationError);
});

test('rejeita mensagem sem nenhuma ação selecionada', () => {
  assert.throws(
    () => ProcessingJob.parse(JSON.stringify({ videoId: 'abc', storagePath: 'abc.mp4' })),
    ValidationError,
  );
});
