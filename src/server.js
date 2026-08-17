'use strict';

const express = require('express');
const config = require('./infra/config');
const logger = require('./infra/logger');

const app = express();

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(config.port, () => {
  logger.info(`API ouvindo na porta ${config.port}`);
});
