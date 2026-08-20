'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ProcessingActions = require('../../src/domain/processingActions');
const { ValidationError } = require('../../src/domain/errors');

test('aceita apenas as resoluções conhecidas, ignorando valores inválidos', () => {
  const actions = ProcessingActions.parse({ resolutions: ['720p', '4k', '1080p'] });

  assert.deepEqual(actions.resolutions, ['720p', '1080p']);
});

test('normaliza um único valor de resolutions (não veio em array) para array', () => {
  const actions = ProcessingActions.parse({ resolutions: '360p' });

  assert.deepEqual(actions.resolutions, ['360p']);
});

test('interpreta strings "true"/"on" de formulário HTML como booleano', () => {
  const actions = ProcessingActions.parse({ resolutions: ['360p'], extractAudio: 'true', watermark: 'on' });

  assert.equal(actions.extractAudio, true);
  assert.equal(actions.watermark, true);
});

test('rejeita quando nenhuma resolução e nenhuma extração de áudio foi escolhida', () => {
  assert.throws(() => ProcessingActions.parse({}), ValidationError);
  assert.throws(() => ProcessingActions.parse({ watermark: true }), ValidationError);
});

test('aceita extração de áudio sozinha, sem nenhuma resolução', () => {
  const actions = ProcessingActions.parse({ extractAudio: true });

  assert.deepEqual(actions.resolutions, []);
  assert.equal(actions.extractAudio, true);
});

test('desliga a marca d\'água se nenhuma resolução foi selecionada', () => {
  const actions = ProcessingActions.parse({ extractAudio: true, watermark: true });

  assert.equal(actions.watermark, false);
});
