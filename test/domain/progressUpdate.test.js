'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ProgressUpdate = require('../../src/domain/ProgressUpdate');

test('arredonda percent para inteiro', () => {
  const update = ProgressUpdate.create({ videoId: 'v1', stage: 'convertendo_720p', percent: 45.7, status: 'processing' });

  assert.equal(update.percent, 46);
});

test('mantém percent nulo quando não informado', () => {
  const update = ProgressUpdate.create({ videoId: 'v1', stage: 'falhou', percent: null, status: 'failed' });

  assert.equal(update.percent, null);
});

test('trata percent undefined como null', () => {
  const update = ProgressUpdate.create({ videoId: 'v1', stage: 'falhou', status: 'failed' });

  assert.equal(update.percent, null);
});

test('inclui timestamp em formato ISO 8601', () => {
  const update = ProgressUpdate.create({ videoId: 'v1', stage: 'concluido', percent: 100, status: 'completed' });

  assert.match(update.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('preserva videoId, stage e status repassados', () => {
  const update = ProgressUpdate.create({ videoId: 'abc-123', stage: 'extraindo_audio', percent: 100, status: 'processing' });

  assert.equal(update.videoId, 'abc-123');
  assert.equal(update.stage, 'extraindo_audio');
  assert.equal(update.status, 'processing');
});

test('inclui o outputPath quando a etapa gerou um arquivo', () => {
  const update = ProgressUpdate.create({
    videoId: 'v1',
    stage: 'convertendo_720p',
    percent: 100,
    status: 'processing',
    outputPath: 'video-720p.mp4',
  });

  assert.equal(update.outputPath, 'video-720p.mp4');
});

test('outputPath é nulo quando a etapa não gerou arquivo (ex: progresso intermediário)', () => {
  const update = ProgressUpdate.create({ videoId: 'v1', stage: 'convertendo_720p', percent: 45, status: 'processing' });

  assert.equal(update.outputPath, null);
});
