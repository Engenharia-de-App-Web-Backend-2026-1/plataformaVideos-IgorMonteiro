'use strict';

const express = require('express');

function createRoutes({ uploadController, progressController, downloadController }) {
  const router = express.Router();

  router.post('/videos', uploadController.middleware, uploadController.handle);
  router.get('/videos/:id/progress', progressController.handle);
  router.get('/videos/:id/files/:filename', downloadController.handle);

  return router;
}

module.exports = createRoutes;
