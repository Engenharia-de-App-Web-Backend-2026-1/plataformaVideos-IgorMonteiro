'use strict';

const fs = require('fs');
const config = require('./infra/config');
const amqpConnection = require('./infra/amqpConnection');
const createAmqpPublisher = require('./infra/amqpPublisher');
const createPostgresVideoRepository = require('./infra/postgresVideoRepository');
const createUploadVideo = require('./usecases/uploadVideo');
const createUploadController = require('./interfaces/http/uploadController');
const createRoutes = require('./interfaces/http/routes');

async function buildContainer() {
  fs.mkdirSync(config.storagePath, { recursive: true });

  const videoRepository = createPostgresVideoRepository();
  const { channel } = await amqpConnection.connect();
  const jobPublisher = createAmqpPublisher(channel);

  const uploadVideoUsecase = createUploadVideo({ videoRepository, jobPublisher });
  const uploadController = createUploadController({ uploadVideoUsecase });
  const routes = createRoutes({ uploadController });

  return { routes };
}

module.exports = buildContainer;
