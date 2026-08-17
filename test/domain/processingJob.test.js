'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ProcessingJob = require('../../src/domain/ProcessingJob');
const { ValidationError } = require('../../src/domain/errors');

test('faz parse de uma mensagem AMQP válida', () => {
  const job = ProcessingJob.parse(JSON.stringify({ videoId: 'abc', storagePath: 'abc.mp4' }));

  assert.deepEqual(job, { videoId: 'abc', storagePath: 'abc.mp4' });
});

test('rejeita JSON malformado', () => {
  assert.throws(() => ProcessingJob.parse('{not json'), ValidationError);
});

test('rejeita mensagem sem videoId ou storagePath', () => {
  assert.throws(() => ProcessingJob.parse(JSON.stringify({ videoId: 'abc' })), ValidationError);
});
