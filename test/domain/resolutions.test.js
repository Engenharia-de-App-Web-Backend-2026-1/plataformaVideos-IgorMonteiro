'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const RESOLUTIONS = require('../../src/domain/resolutions');

test('define exatamente as três resoluções exigidas em ordem crescente', () => {
  assert.deepEqual(
    RESOLUTIONS.map((r) => r.label),
    ['360p', '720p', '1080p'],
  );
  assert.deepEqual(
    RESOLUTIONS.map((r) => r.height),
    [360, 720, 1080],
  );
});

test('cada resolução tem label e height válidos', () => {
  for (const resolution of RESOLUTIONS) {
    assert.equal(typeof resolution.label, 'string');
    assert.equal(typeof resolution.height, 'number');
    assert.ok(resolution.height > 0);
  }
});
