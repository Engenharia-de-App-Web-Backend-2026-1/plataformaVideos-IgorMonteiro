'use strict';

function createVideoStatusController({ getVideoStatusUsecase }) {
  return {
    async handle(req, res, next) {
      try {
        const video = await getVideoStatusUsecase({ videoId: req.params.id });
        res.status(200).json(video);
      } catch (err) {
        next(err);
      }
    },
  };
}

module.exports = createVideoStatusController;
