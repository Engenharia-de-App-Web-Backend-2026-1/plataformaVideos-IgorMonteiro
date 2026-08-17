'use strict';

const amqp = require('amqplib');
const config = require('./config');

const QUEUE_NAME = 'video-processing';

async function connect() {
  const connection = await amqp.connect(config.rabbitmqUrl);
  const channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  return { connection, channel };
}

module.exports = { connect, QUEUE_NAME };
