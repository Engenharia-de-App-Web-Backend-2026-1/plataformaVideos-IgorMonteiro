'use strict';

const Redis = require('ioredis');
const config = require('./config');

function createPublisher() {
  const redis = new Redis(config.redisUrl);

  return {
    async publishProgress(videoId, update) {
      await redis.publish(`video:${videoId}`, JSON.stringify(update));
    },
  };
}

function createSubscriber() {
  return new Redis(config.redisUrl);
}

module.exports = { createPublisher, createSubscriber };
