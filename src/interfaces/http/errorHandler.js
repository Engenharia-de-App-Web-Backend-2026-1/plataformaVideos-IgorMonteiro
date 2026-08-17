'use strict';

const { ValidationError } = require('../../domain/errors');
const logger = require('../../infra/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
    return;
  }

  logger.error('erro não tratado', { message: err.message, stack: err.stack });
  res.status(500).json({ error: 'erro interno' });
}

module.exports = errorHandler;
