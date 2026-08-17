'use strict';

const express = require('express');

function createRoutes({ uploadController, progressController }) {
  const router = express.Router();

  router.post('/videos', uploadController.middleware, uploadController.handle);
  router.get('/videos/:id/progress', progressController.handle);

  return router;
}

module.exports = createRoutes;
