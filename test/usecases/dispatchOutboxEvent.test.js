'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const createDispatchOutboxEvent = require('../../src/usecases/dispatchOutboxEvent');

function createLogger() {
  const infos = [];
  return {
    info(message, meta) {
      infos.push({ message, meta });
    },
    warn() {},
    error() {},
    infos,
  };
}

test('publica o payload do evento pendente na fila e retorna true', async () => {
  const job = { videoId: 'v1', storagePath: 'v1.mp4', actions: { resolutions: ['720p'] } };
  const published = [];

  const outboxRepository = {
    async dispatchNextPendingJob(publish) {
      await publish(job);
      return true;
    },
  };
  const jobPublisher = {
    async publishVideoJob(payload) {
      published.push(payload);
    },
  };
  const logger = createLogger();
  const dispatchOutboxEvent = createDispatchOutboxEvent({ outboxRepository, jobPublisher, logger });

  const result = await dispatchOutboxEvent();

  assert.equal(result, true);
  assert.deepEqual(published, [job]);
  assert.equal(logger.infos.length, 1);
});

test('quando não há evento pendente, não publica nada e retorna false', async () => {
  const outboxRepository = {
    async dispatchNextPendingJob() {
      return false;
    },
  };
  const jobPublisher = {
    async publishVideoJob() {
      throw new Error('não deveria ser chamado');
    },
  };
  const logger = createLogger();
  const dispatchOutboxEvent = createDispatchOutboxEvent({ outboxRepository, jobPublisher, logger });

  const result = await dispatchOutboxEvent();

  assert.equal(result, false);
  assert.equal(logger.infos.length, 0);
});

test('propaga erro do publisher (a transação da outbox faz rollback e o evento continua pendente)', async () => {
  const outboxRepository = {
    async dispatchNextPendingJob(publish) {
      await publish({ videoId: 'v1' });
      return true;
    },
  };
  const jobPublisher = {
    async publishVideoJob() {
      throw new Error('RabbitMQ indisponível');
    },
  };
  const logger = createLogger();
  const dispatchOutboxEvent = createDispatchOutboxEvent({ outboxRepository, jobPublisher, logger });

  await assert.rejects(() => dispatchOutboxEvent(), /RabbitMQ indisponível/);
});
