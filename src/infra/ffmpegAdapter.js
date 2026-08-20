'use strict';

const ffmpeg = require('fluent-ffmpeg');

const WATERMARK_TEXT = 'P1-Dev';
const FONT_FILE = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

function transcode({ inputPath, outputPath, height, watermark, onProgress }) {
  return new Promise((resolve, reject) => {
    const filters = [`scale=-2:${height}`];
    if (watermark) {
      filters.push(
        `drawtext=fontfile=${FONT_FILE}:text='${WATERMARK_TEXT}':fontcolor=white:fontsize=24:x=10:y=h-th-10:box=1:boxcolor=black@0.5`,
      );
    }

    ffmpeg(inputPath)
      .videoFilters(filters)
      .on('progress', (progress) => {
        if (onProgress && typeof progress.percent === 'number') {
          onProgress(Math.min(100, Math.max(0, progress.percent)));
        }
      })
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath);
  });
}

function extractAudio({ inputPath, outputPath }) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath);
  });
}

module.exports = { transcode, extractAudio };
