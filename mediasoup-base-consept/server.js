const fs = require("fs");
const https = require("https");
const socketio = require("socket.io");
const mediasoup = require("mediasoup");
const createWorkers = require("./createWorkers");
const config = require("./config");
const express = require("express");
const createWebRtcTransportBothKinds = require("./createWebRtcTransportBothKinds");

const app = express();

/** Set public folder as base url for front end's files  */
app.use(express.static("public"));

/** Set HTTPS  */
const key = fs.readFileSync("./config/cert.key");
const cert = fs.readFileSync("./config/cert.crt");
const options = { key, cert };
const httpsServer = https.createServer(options, app);

/** socket io config */
const io = socketio(httpsServer, {
  cors: ["https://192.168.0.16:" + config.port],
});

let workers = null;
let router = null;
let theProducer = null;

const initMediaSoup = async () => {
  workers = await createWorkers();
  router = await workers[0].createRouter({
    mediaCodecs: config.routerMediaCodecs,
  });
};

io.on("connect", (socket) => {
  let thisClientProducerTransport = null;
  let thisClientProducer = null;

  let thisClientConsumerTransport = null;
  let thisClientConsumer = null;

  socket.on("getRtpCap", (cb) => {
    cb(router.rtpCapabilities);
  });

  socket.on("create-producer-transport", async (cb) => {
    const { transportParams, transport } = await createWebRtcTransportBothKinds(
      router
    );
    thisClientProducerTransport = transport;
    cb(transportParams);
  });

  socket.on("connect-producer-transport", async (dtlsParameters, cb) => {
    try {
      await thisClientProducerTransport.connect(dtlsParameters);
      cb("success");
    } catch (error) {
      cb("error");
    }
  });

  socket.on("start-producing", async (parameter, cb) => {
    try {
      thisClientProducer = await thisClientProducerTransport.produce(parameter);

      thisClientProducer.on("transportclose", () => {
        console.log("consumer transport closed");
        thisClientProducer.close();
      });

      theProducer = thisClientProducer;
      cb(thisClientProducer.id);
    } catch (error) {
      cb("error");
    }
  });

  socket.on("create-consumer-transport", async (cb) => {
    const { transportParams, transport } = await createWebRtcTransportBothKinds(
      router
    );
    thisClientConsumerTransport = transport;
    cb(transportParams);
  });

  socket.on("connect-consumer-transport", async (dtlsParameters, cb) => {
    try {
      await thisClientConsumerTransport.connect(dtlsParameters);
      cb("success");
    } catch (error) {
      cb("error");
    }
  });

  socket.on("consume-media", async ({ rtpCapabilities }, cb) => {
    if (!theProducer) {
      cb("noProducer");
    } else if (
      !router.canConsume({ producerId: theProducer.id, rtpCapabilities })
    ) {
      cb("canNotConsume");
    }

    console.log(theProducer);

    thisClientConsumer = await thisClientConsumerTransport.consume({
      producerId: theProducer.id,
      rtpCapabilities,
      paused: true,
    });

    thisClientConsumer.on("transportclose", () => {
      console.log("consumer transport closed");
      thisClientConsumer.close();
    });

    const consumerParams = {
      producerId: theProducer.id,
      id: thisClientConsumer.id,
      kind: thisClientConsumer.kind,
      rtpParameters: thisClientConsumer.rtpParameters,
    };
    cb(consumerParams);
  });

  socket.on("unpauseConsumer", async () => {
    await thisClientConsumer.resume();
  });

  socket.on("close-all", (cb) => {
    try {
      thisClientConsumerTransport?.close();
      thisClientProducerTransport?.close();
      cb("closed");
    } catch (error) {
      cb("closeError");
    }
  });
});

initMediaSoup(); // build mediasoup server/sfu

/** run on port 3030 */
httpsServer.listen(config.port);
