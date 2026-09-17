'use strict';

const { buildOutboxRelayContainer } = require('./container');
const config = require('./infra/config');
const logger = require('./infra/logger');

// Polling Publisher da Transactional Outbox (ver README/ADR): processo
// dedicado, separado da API e do worker, que drena a tabela `outbox` e
// publica cada evento pendente na fila AMQP.
async function start() {
  const { dispatchOutboxEvent } = await buildOutboxRelayContainer();

  async function tick() {
    try {
      // Drena tudo que já está pendente antes de esperar o próximo poll.
      // eslint-disable-next-line no-empty
      while (await dispatchOutboxEvent()) {}
    } catch (err) {
      logger.error('falha ao despachar evento da outbox', { message: err.message });
    } finally {
      setTimeout(tick, config.outboxRelay.pollIntervalMs);
    }
  }

  logger.info('outbox relay iniciado', { pollIntervalMs: config.outboxRelay.pollIntervalMs });
  tick();
}

start().catch((err) => {
  logger.error('falha ao iniciar outbox relay', { message: err.message, stack: err.stack });
  process.exit(1);
});
