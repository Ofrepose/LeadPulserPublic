const inspector = require('inspector');

// Connect to the Inspector debugger
const session = new inspector.Session();
session.connect();

// Enable heap profiling
session.post('HeapProfiler.enable', () => {
  console.log('Heap profiling enabled');
});

// Export a function to capture a heap snapshot
module.exports.captureHeapSnapshot = (filename) => {
  try{
    session.post('HeapProfiler.takeHeapSnapshot', (err, { snapshot }) => {
      if (err) {
        console.error(err);
      } else {
        require('fs').writeFileSync(filename, snapshot);
        console.log(snapshot)
        console.log(`Heap snapshot written to file ${filename}`);
      }
    });
  }catch(err){
    console.log(err)
  }
};
