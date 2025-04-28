import createConsumer from './createConsumer';
import createConsumerTransport from './createConsumerTransport';

const requestTransportToConsume = async (
  consumeData,
  socket,
  device,
  consumers,
  setActiveSpeakers, // We'll pass this from the component
) => {
  try {
    // Store active speakers info to show indicators
    const activeSpeakersList = [];

    // Process each audio producer ID to create consumer transports
    for (let i = 0; i < consumeData.audioPidsToCreate.length; i++) {
      const audioPid = consumeData.audioPidsToCreate[i];
      const videoPid = consumeData.videoPidsToCreate[i];
      const userName = consumeData.associatedUserNames[i];

      // Request transport params for this audio producer
      const consumerTransportParams = await socket.emitWithAck(
        'requestTransport',
        {
          type: 'consumer',
          audioPid,
        },
      );

      console.log('Consumer transport params:', consumerTransportParams);

      // Create consumer transport
      const consumerTransport = createConsumerTransport(
        consumerTransportParams,
        device,
        socket,
        audioPid,
      );

      // Create audio and video consumers
      const [audioConsumer, videoConsumer] = await Promise.all([
        createConsumer(consumerTransport, audioPid, device, socket, 'audio', i),
        createConsumer(consumerTransport, videoPid, device, socket, 'video', i),
      ]);

      console.log('Audio consumer created:', audioConsumer);
      console.log('Video consumer created:', videoConsumer);

      // Store consumer information
      consumers[audioPid] = {
        userName,
        consumerTransport,
        audioConsumer,
        videoConsumer,
        isActive: false, // Will be used to track if this person is speaking
      };

      // Add to active speakers list with initial state
      activeSpeakersList.push({
        id: audioPid,
        userName: userName,
        isActive: false,
      });
    }

    // Update the active speakers state in the parent component
    setActiveSpeakers(activeSpeakersList);
  } catch (error) {
    console.error('Error in requestTransportToConsume:', error);
  }
};

export default requestTransportToConsume;
