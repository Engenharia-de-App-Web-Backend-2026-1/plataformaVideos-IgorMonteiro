'use strict';

const Video = require('../domain/Video');

function createUploadVideo({ videoRepository, jobPublisher }) {
  return async function uploadVideo({ originalFilename, storagePath }) {
    const video = Video.create({ originalFilename, storagePath });

    await videoRepository.save(video);
    await jobPublisher.publishVideoJob({ videoId: video.id, storagePath: video.storagePath });

    return video;
  };
}

module.exports = createUploadVideo;
