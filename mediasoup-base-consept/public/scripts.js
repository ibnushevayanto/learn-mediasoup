let socket = null;
let device = null;
let localStream = null;

let producerTransport = null;
let producer = null;

let consumerTransport = null;
let consumer = null;

const initConnect = () => {
  socket = io("https://192.168.0.5:3040");
  connectButton.innerHTML = "Connecting...";
  connectButton.disabled = true;

  addSocketListener();
};

const deviceSetup = async () => {
  device = new mediasoupClient.Device();
  const routerRtpCapabilities = await socket.emitWithAck("getRtpCap");
  await device.load({ routerRtpCapabilities });

  deviceButton.disabled = true;
  createProdButton.disabled = false;
  createConsButton.disabled = false;
  disconnectButton.disabled = false;
};

const createProducer = async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.srcObject = localStream;
  } catch (error) {
    console.error("GUM error", error);
  }

  const data = await socket.emitWithAck("create-producer-transport");
  const transport = await device.createSendTransport({
    ...data,
  });
  producerTransport = transport;

  // Connect wont trigerred until the transport.produce called
  producerTransport.on("connect", async ({ dtlsParameters }, cb, errback) => {
    const resp = await socket.emitWithAck("connect-producer-transport", {
      dtlsParameters,
    });

    if (resp === "success") {
      cb();
    } else {
      errback("error");
    }
  });
  producerTransport.on(
    "produce",
    async ({ kind, rtpParameters }, cb, errback) => {
      const resp = await socket.emitWithAck("start-producing", {
        kind,
        rtpParameters,
      });

      if (resp === "error") {
        errback();
      }

      cb({ id: resp });
    }
  );

  createProdButton.disabled = true;
  publishButton.disabled = false;
};

const publish = async () => {
  console.log("Publish feed");
  const track = localStream.getVideoTracks()[0];
  producer = await producerTransport.produce({ track });

  publishButton.disabled = true;
  createConsButton.disabled = false;
};

const createConsumer = async () => {
  const data = await socket.emitWithAck("create-consumer-transport");
  const transport = await device.createRecvTransport({
    ...data,
  });
  consumerTransport = transport;

  // Connect wont trigerred until the transport.consume called
  consumerTransport.on("connect", async ({ dtlsParameters }, cb, errback) => {
    const resp = await socket.emitWithAck("connect-consumer-transport", {
      dtlsParameters,
    });

    if (resp === "success") {
      cb();
    } else {
      errback("error");
    }

    createConsButton.disabled = true;
    consumeButton.disabled = false;
  });

  createConsButton.disabled = true;
  consumeButton.disabled = false;
};

const consume = async () => {
  const consumerParams = await socket.emitWithAck("consume-media", {
    rtpCapabilities: device.rtpCapabilities,
  });
  if (consumerParams === "noProducer") console.log("theres no producer");
  else if (consumerParams === "canNotConsume")
    console.log("rtpCapabilities failed. cannot consume");
  else {
    consumer = await consumerTransport.consume(consumerParams);
    const { track } = consumer;
    remoteVideo.srcObject = new MediaStream([track]);

    console.log(track, "track is live", remoteVideo);

    await socket.emitWithAck("unpauseConsumer");
  }
};

const disconnect = async () => {
  const resp = await socket.emitWithAck("close-all");

  console.log(resp);

  if (resp === "closeError")
    console.log("something error when you trying to disconnect");

  producerTransport?.close();
  consumerTransport?.close();
};

function addSocketListener() {
  socket.on("connect", () => {
    connectButton.innerHTML = "Connected";
    deviceButton.disabled = false;
  });
}
