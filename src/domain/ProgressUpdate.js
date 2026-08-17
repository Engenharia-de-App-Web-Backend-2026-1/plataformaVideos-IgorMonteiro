'use strict';

function create({ videoId, stage, percent, status }) {
  return {
    videoId,
    stage,
    percent: percent === null || percent === undefined ? null : Math.round(percent),
    status,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { create };
