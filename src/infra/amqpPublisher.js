'use strict';

const { QUEUE_NAME } = require('./amqpConnection');

function createAmqpPublisher(channel) {
  return {
    async publishVideoJob(job) {
      const payload = Buffer.from(JSON.stringify(job));
      channel.sendToQueue(QUEUE_NAME, payload, { persistent: true });
    },
  };
}

module.exports = createAmqpPublisher;
