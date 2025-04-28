const createWebRtcTransportBothKinds = (router) =>
  new Promise(async (resolve, reject) => {
    const transport = await router.createWebRtcTransport({
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      listenInfos: [
        {
          protocol: "udp",
          ip: "0.0.0.0",
          announcedAddress: "192.168.0.5",
        },
        {
          protocol: "tcp",
          ip: "0.0.0.0",
          announcedAddress: "192.168.0.5",
        },
      ],
    });
    const transportParams = {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };

    resolve({ transport, transportParams });
  });

module.exports = createWebRtcTransportBothKinds;
