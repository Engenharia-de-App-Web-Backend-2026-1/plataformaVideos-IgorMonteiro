'use strict';

const express = require('express');
const config = require('./infra/config');
const logger = require('./infra/logger');
const { buildApiContainer } = require('./container');
const errorHandler = require('./interfaces/http/errorHandler');

async function start() {
  const { routes } = await buildApiContainer();

  const app = express();

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use(routes);
  app.use(errorHandler);

  app.listen(config.port, () => {
    logger.info(`API ouvindo na porta ${config.port}`);
  });
}

start().catch((err) => {
  logger.error('falha ao iniciar API', { message: err.message, stack: err.stack });
  process.exit(1);
});
