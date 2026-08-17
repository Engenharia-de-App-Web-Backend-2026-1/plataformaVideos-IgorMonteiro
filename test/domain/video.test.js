'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Video = require('../../src/domain/Video');
const { ValidationError } = require('../../src/domain/errors');

test('cria um vídeo válido com status inicial "uploaded"', () => {
  const video = Video.create({ originalFilename: 'aula.mp4', storagePath: '123-aula.mp4' });

  assert.equal(video.status, Video.STATUS.UPLOADED);
  assert.equal(video.originalFilename, 'aula.mp4');
  assert.match(video.id, /^[0-9a-f-]{36}$/);
});

test('rejeita vídeo sem originalFilename', () => {
  assert.throws(
    () => Video.create({ storagePath: '123-aula.mp4' }),
    ValidationError,
  );
});

test('rejeita vídeo sem storagePath', () => {
  assert.throws(
    () => Video.create({ originalFilename: 'aula.mp4' }),
    ValidationError,
  );
});
