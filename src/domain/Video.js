'use strict';

const { randomUUID } = require('crypto');
const { ValidationError } = require('./errors');

const STATUS = Object.freeze({
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

function create({ originalFilename, storagePath }) {
  if (!originalFilename || typeof originalFilename !== 'string') {
    throw new ValidationError('originalFilename é obrigatório');
  }
  if (!storagePath || typeof storagePath !== 'string') {
    throw new ValidationError('storagePath é obrigatório');
  }

  return {
    id: randomUUID(),
    originalFilename,
    storagePath,
    status: STATUS.UPLOADED,
    progress: {},
  };
}

module.exports = { create, STATUS };
