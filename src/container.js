'use strict';

const fs = require('fs');
const config = require('./infra/config');
const logger = require('./infra/logger');
const amqpConnection = require('./infra/amqpConnection');
const createAmqpPublisher = require('./infra/amqpPublisher');
const createPostgresVideoRepository = require('./infra/postgresVideoRepository');
const ffmpegAdapter = require('./infra/ffmpegAdapter');
const redisPubSub = require('./infra/redisPubSub');
const transcriptionService = require('./services/transcriptionService');

const createUploadVideo = require('./usecases/uploadVideo');
const createProcessVideo = require('./usecases/processVideo');

const createUploadController = require('./interfaces/http/uploadController');
const createProgressController = require('./interfaces/http/progressController');
const createRoutes = require('./interfaces/http/routes');
const createVideoJobConsumer = require('./interfaces/messaging/videoJobConsumer');

async function buildApiContainer() {
  fs.mkdirSync(config.storagePath, { recursive: true });

  const videoRepository = createPostgresVideoRepository();
  const { channel } = await amqpConnection.connect();
  const jobPublisher = createAmqpPublisher(channel);
  const subscriber = redisPubSub.createSubscriber();

  const uploadVideoUsecase = createUploadVideo({ videoRepository, jobPublisher });
  const uploadController = createUploadController({ uploadVideoUsecase });
  const progressController = createProgressController({ subscriber });
  const routes = createRoutes({ uploadController, progressController });

  return { routes };
}

async function buildWorkerContainer() {
  fs.mkdirSync(config.storagePath, { recursive: true });

  const videoRepository = createPostgresVideoRepository();
  const { channel } = await amqpConnection.connect();
  await channel.prefetch(1);

  const progressPublisher = redisPubSub.createPublisher();

  const processVideoUsecase = createProcessVideo({
    videoRepository,
    videoProcessor: ffmpegAdapter,
    progressPublisher,
    transcriptionService,
    logger,
    storageBasePath: config.storagePath,
  });

  const videoJobConsumer = createVideoJobConsumer({ processVideoUsecase });

  return { channel, videoJobConsumer };
}

module.exports = { buildApiContainer, buildWorkerContainer };
