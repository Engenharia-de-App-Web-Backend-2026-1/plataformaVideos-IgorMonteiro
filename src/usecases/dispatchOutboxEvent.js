'use strict';

// Relay da Transactional Outbox (Polling Publisher, ver README/ADR): lê o
// próximo evento pendente e publica na fila. Não conhece SQL nem AMQP — só
// orquestra os dois métodos de domínio recebidos por parâmetro.
function createDispatchOutboxEvent({ outboxRepository, jobPublisher, logger }) {
  return async function dispatchOutboxEvent() {
    const dispatched = await outboxRepository.dispatchNextPendingJob(async (job) => {
      await jobPublisher.publishVideoJob(job);
    });

    if (dispatched) {
      logger.info('evento pendente da outbox publicado na fila');
    }

    return dispatched;
  };
}

module.exports = createDispatchOutboxEvent;
