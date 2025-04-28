const os = require("os");
const totalThreads = os.cpus().length; // maximum number of allowed workers
const mediasoup = require("mediasoup");
const config = require("./config");

const createWorkers = () =>
  new Promise(async (resolve, reject) => {
    let workers = [];

    for (let index = 0; index < totalThreads; index++) {
      const worker = await mediasoup.createWorker(config.workerSettings);

      worker.on("died", () => {
        console.log("worker has died");
        process.exit(1);
      });

      workers.push(worker);
    }

    resolve(workers);
  });

module.exports = createWorkers;
