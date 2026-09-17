'use strict';

const fs = require('fs');
const config = require('./infra/config');
const logger = require('./infra/logger');
const amqpConnection = require('./infra/amqpConnection');
const createAmqpPublisher = require('./infra/amqpPublisher');
const createPostgresVideoRepository = require('./infra/postgresVideoRepository');
const createPostgresOutboxRepository = require('./infra/postgresOutboxRepository');
const ffmpegAdapter = require('./infra/ffmpegAdapter');
const redisPubSub = require('./infra/redisPubSub');
const createRedisClient = require('./infra/redisClient');
const createRedisVideoCache = require('./infra/redisVideoCache');
const createRedisRateLimiter = require('./infra/redisRateLimiter');
const transcriptionService = require('./services/transcriptionService');

const createUploadVideo = require('./usecases/uploadVideo');
const createProcessVideo = require('./usecases/processVideo');
const createGetVideoFile = require('./usecases/getVideoFile');
const createGetVideoStatus = require('./usecases/getVideoStatus');
const createDispatchOutboxEvent = require('./usecases/dispatchOutboxEvent');

const createUploadController = require('./interfaces/http/uploadController');
const createProgressController = require('./interfaces/http/progressController');
const createDownloadController = require('./interfaces/http/downloadController');
const createVideoStatusController = require('./interfaces/http/videoStatusController');
const createRateLimitMiddleware = require('./interfaces/http/rateLimitMiddleware');
const createRoutes = require('./interfaces/http/routes');
const createVideoJobConsumer = require('./interfaces/messaging/videoJobConsumer');

async function buildApiContainer() {
  fs.mkdirSync(config.storagePath, { recursive: true });

  // A API não fala mais AMQP diretamente: o job entra na fila via
  // Transactional Outbox (tabela `outbox` + relay separado), então o
  // upload segue funcionando mesmo se o RabbitMQ estiver fora do ar
  // (Basically Available — ver README/ADR).
  const videoRepository = createPostgresVideoRepository();
  const subscriber = redisPubSub.createSubscriber();
  const redisClient = createRedisClient();
  const videoCache = createRedisVideoCache({ redis: redisClient, ...config.cache });
  const rateLimiter = createRedisRateLimiter({ redis: redisClient, ...config.rateLimit });

  const uploadVideoUsecase = createUploadVideo({ videoRepository });
  const getVideoFileUsecase = createGetVideoFile({ videoRepository });
  const getVideoStatusUsecase = createGetVideoStatus({ videoRepository, videoCache });

  const uploadController = createUploadController({ uploadVideoUsecase });
  const progressController = createProgressController({ subscriber });
  const downloadController = createDownloadController({ getVideoFileUsecase });
  const videoStatusController = createVideoStatusController({ getVideoStatusUsecase });
  const rateLimitMiddleware = createRateLimitMiddleware({ rateLimiter });

  const routes = createRoutes({
    uploadController,
    progressController,
    downloadController,
    videoStatusController,
    rateLimitMiddleware,
  });

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

async function buildOutboxRelayContainer() {
  const outboxRepository = createPostgresOutboxRepository();
  const { channel } = await amqpConnection.connect();
  const jobPublisher = createAmqpPublisher(channel);

  const dispatchOutboxEvent = createDispatchOutboxEvent({ outboxRepository, jobPublisher, logger });

  return { dispatchOutboxEvent };
}

module.exports = { buildApiContainer, buildWorkerContainer, buildOutboxRelayContainer };
