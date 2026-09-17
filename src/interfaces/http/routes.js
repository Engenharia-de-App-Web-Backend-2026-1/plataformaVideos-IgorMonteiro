'use strict';

const express = require('express');

function createRoutes({
  uploadController,
  progressController,
  downloadController,
  videoStatusController,
  rateLimitMiddleware,
}) {
  const router = express.Router();

  router.post('/videos', rateLimitMiddleware, uploadController.middleware, uploadController.handle);
  router.get('/videos/:id', videoStatusController.handle);
  router.get('/videos/:id/progress', progressController.handle);
  router.get('/videos/:id/files/:filename', downloadController.handle);

  return router;
}

module.exports = createRoutes;
