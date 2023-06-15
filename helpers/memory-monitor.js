const heapdump = require('heapdumpjs');

setInterval(() => {
  const memoryUsage = process.memoryUsage();
  if (memoryUsage.rss > 500 * 1024 * 1024) {
    heapdump.writeSnapshot((err, filename) => {
      if (err) {
        console.error(err);
      } else {
        console.log(`Heapdump written to ${filename}`);
      }
    });
  }
}, 60000);