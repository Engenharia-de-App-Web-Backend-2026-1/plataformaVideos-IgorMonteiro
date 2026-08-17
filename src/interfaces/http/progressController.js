'use strict';

function createProgressController({ subscriber }) {
  return {
    handle(req, res) {
      const { id } = req.params;
      const channel = `video:${id}`;

      res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.flushHeaders();

      const onMessage = (msgChannel, message) => {
        if (msgChannel === channel) {
          res.write(`data: ${message}\n\n`);
        }
      };

      subscriber.on('message', onMessage);
      subscriber.subscribe(channel);

      const keepAlive = setInterval(() => {
        res.write(': ping\n\n');
      }, 15000);

      req.on('close', () => {
        clearInterval(keepAlive);
        subscriber.unsubscribe(channel);
        subscriber.off('message', onMessage);
      });
    },
  };
}

module.exports = createProgressController;
