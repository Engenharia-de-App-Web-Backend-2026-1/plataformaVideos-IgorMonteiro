'use strict';

const { buildWorkerContainer } = require('./container');
const { QUEUE_NAME } = require('./infra/amqpConnection');
const logger = require('./infra/logger');

async function start() {
  const { channel, videoJobConsumer } = await buildWorkerContainer();

  await channel.consume(QUEUE_NAME, (msg) => videoJobConsumer(channel, msg), { noAck: false });

  logger.info(`worker consumindo a fila ${QUEUE_NAME}`);
}

start().catch((err) => {
  logger.error('falha ao iniciar worker', { message: err.message, stack: err.stack });
  process.exit(1);
});
