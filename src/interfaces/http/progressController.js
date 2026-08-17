'use strict';

function createProgressController({ subscriber }) {
  const channelRefCounts = new Map();

  function acquireChannel(channel) {
    const count = channelRefCounts.get(channel) || 0;
    channelRefCounts.set(channel, count + 1);
    if (count === 0) {
      subscriber.subscribe(channel);
    }
  }

  function releaseChannel(channel) {
    const count = channelRefCounts.get(channel) || 0;
    if (count <= 1) {
      channelRefCounts.delete(channel);
      subscriber.unsubscribe(channel);
    } else {
      channelRefCounts.set(channel, count - 1);
    }
  }

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
      acquireChannel(channel);

      const keepAlive = setInterval(() => {
        res.write(': ping\n\n');
      }, 15000);

      req.on('close', () => {
        clearInterval(keepAlive);
        releaseChannel(channel);
        subscriber.off('message', onMessage);
      });
    },
  };
}

module.exports = createProgressController;
