'use strict';

const path = require('path');
const multer = require('multer');
const config = require('../../infra/config');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.storagePath),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage });

function createUploadController({ uploadVideoUsecase }) {
  return {
    middleware: upload.single('video'),
    async handle(req, res, next) {
      try {
        if (!req.file) {
          res.status(400).json({ error: 'arquivo de vídeo é obrigatório (campo "video")' });
          return;
        }

        const { video, actions, plannedOutputs } = await uploadVideoUsecase({
          originalFilename: req.file.originalname,
          storagePath: req.file.filename,
          actions: {
            resolutions: req.body.resolutions,
            extractAudio: req.body.extractAudio,
            watermark: req.body.watermark,
          },
        });

        res.status(202).json({
          videoId: video.id,
          status: video.status,
          actions,
          // onde os arquivos resultantes vão ser salvos: diretório é o ponto
          // de montagem compartilhado entre API e worker (ver CLAUDE.md,
          // "Volume compartilhado"); os nomes são o que o worker vai gerar.
          destination: {
            directory: config.storagePath,
            files: plannedOutputs,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

module.exports = createUploadController;
