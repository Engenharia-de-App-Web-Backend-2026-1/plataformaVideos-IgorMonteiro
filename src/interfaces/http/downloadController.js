'use strict';

const path = require('path');
const config = require('../../infra/config');

function createDownloadController({ getVideoFileUsecase }) {
  return {
    async handle(req, res, next) {
      try {
        const { id, filename } = req.params;
        const { filename: safeFilename } = await getVideoFileUsecase({ videoId: id, filename });
        const absolutePath = path.join(config.storagePath, safeFilename);

        res.download(absolutePath, safeFilename, (err) => {
          if (!err || res.headersSent) return;
          if (err.code === 'ENOENT') {
            res.status(404).json({ error: 'arquivo ainda não está pronto' });
            return;
          }
          next(err);
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

module.exports = createDownloadController;
