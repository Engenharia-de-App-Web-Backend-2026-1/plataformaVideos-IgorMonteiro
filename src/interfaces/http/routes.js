'use strict';

const express = require('express');

function createRoutes({ uploadController }) {
  const router = express.Router();

  router.post('/videos', uploadController.middleware, uploadController.handle);

  return router;
}

module.exports = createRoutes;
