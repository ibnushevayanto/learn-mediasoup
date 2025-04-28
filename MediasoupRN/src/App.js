import React, {useEffect, useState, useRef} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import {io} from 'socket.io-client';
import {endpointApi} from './config';
import {
  registerGlobals,
  mediaDevices,
  RTCView,
  MediaStream,
} from 'react-native-webrtc';
import {Device} from 'mediasoup-client';
import createProducerTransport from './utils/createProducerTransport';
import createProducer from './utils/createProducer';
import requestTransportToConsume from './utils/requestTransportToConsume';

export default function CameraScreen() {
  const [hasPermission, setHasPermission] = useState(false);
  const [showModal, setShowModal] = useState(true);
  const [roomName, setRoomName] = useState('');
  const [userName, setUserName] = useState('');
  const [socket, setSocket] = useState(null);
  const [device, setDevice] = useState();
  const [localStream, setLocalStream] = useState(null);
  const [producerTransport, setProducerTransport] = useState(null);
  const [videoProducer, setVideoProducer] = useState(null);
  const [audioProducer, setAudioProducer] = useState(null);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [activeSpeakers, setActiveSpeakers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Store consumers in a ref to avoid re-renders
  const consumersRef = useRef({});

  useEffect(() => {
    const initiate = async () => {
      try {
        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video: {facingMode: 'environment'},
        });
        setLocalStream(stream);
        setHasPermission(true);
      } catch (err) {
        console.log('Media permission error:', err);
        setHasPermission(false);
      }

      /** Setup the websocket */
      const newSocket = io(endpointApi, {
        rejectUnauthorized: false,
      });

      newSocket.on('connect', () => {
        console.log('Connected');
      });

      newSocket.on('connect_error', err => {
        console.warn(
          err.message,
          err.description,
          err.context,
          err.req,
          err.code,
          err.message,
          err.context,
        );
      });

      setSocket(newSocket);

      /** End of websocket configuration */

      registerGlobals();
    };

    initiate();

    return () => {
      handleLeaveRoom();
      if (socket) {
        socket.disconnect();
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleJoin = async () => {
    setIsLoading(true);

    const joinRoomResp = await socket.emitWithAck('joinRoom', {
      userName,
      roomName,
    });

    const myDevice = new Device();
    await myDevice.load({
      routerRtpCapabilities: joinRoomResp.routerRtpCapabilities,
    });

    setDevice(myDevice);

    if (!localStream) {
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {facingMode: 'environment'},
      });
      setLocalStream(stream);
    }

    const producerTransport = await createProducerTransport(socket, myDevice);
    setProducerTransport(producerTransport);

    const producers = await createProducer(localStream, producerTransport);
    setAudioProducer(producers.audioProducer);
    setVideoProducer(producers.videoProducer);

    // Handle active speakers updates
    socket.on('updateActiveSpeakers', async newListOfActives => {
      console.log('Active speakers updated:', newListOfActives);

      // Update active speakers list with new data
      setActiveSpeakers(prevSpeakers => {
        return prevSpeakers.map(speaker => ({
          ...speaker,
          isActive: newListOfActives.includes(speaker.id),
        }));
      });
    });

    // Handle new producers to consume
    socket.on('newProducersToConsume', consumeData => {
      console.log('New producers to consume:', consumeData);
      requestTransportToConsume(
        consumeData,
        socket,
        myDevice,
        consumersRef.current,
        setActiveSpeakers,
      );
    });

    setIsLoading(false);
    setShowModal(false);
  };

  const toggleAudio = () => {
    if (!audioProducer) return;

    if (audioProducer.paused) {
      audioProducer.resume();
      setIsAudioOn(true);
      socket.emit('audioChange', 'unmute');
    } else {
      audioProducer.pause();
      setIsAudioOn(false);
      socket.emit('audioChange', 'mute');
    }
  };

  const handleLeaveRoom = async () => {
    try {
      if (socket) {
        // Emit close-all event to server
        await socket.emitWithAck('close-all');

        // Clean up local resources
        if (audioProducer) {
          audioProducer.close();
        }

        if (videoProducer) {
          videoProducer.close();
        }

        if (producerTransport) {
          producerTransport.close();
        }

        // Clean up consumers
        Object.values(consumersRef.current).forEach(consumer => {
          if (consumer.transport) {
            consumer.transport.close();
          }
          if (consumer.consumer) {
            consumer.consumer.close();
          }
        });

        // Reset state
        setProducerTransport(null);
        setVideoProducer(null);
        setAudioProducer(null);
        setActiveSpeakers([]);
        consumersRef.current = {};

        // Show join modal again
        setShowModal(true);
      }
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  };

  if (!hasPermission) {
    return <View style={{flex: 1, backgroundColor: 'black'}} />;
  }

  return (
    <View style={styles.container}>
      {localStream && (
        <RTCView
          streamURL={localStream.toURL()}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
        />
      )}

      {/* Active Speakers List */}
      <View style={styles.activeSpeakersContainer}>
        <FlatList
          data={activeSpeakers.filter(speaker => speaker.isActive)}
          keyExtractor={item => item.id}
          renderItem={({item}) => (
            <View style={styles.activeSpeakerItem}>
              <View style={styles.activeSpeakerIndicator} />
              <Text style={styles.activeSpeakerText}>{item.userName}</Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.noSpeakersText}>No active speakers</Text>
          }
        />
      </View>

      {/* Audio Toggle Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            isAudioOn ? styles.buttonSuccess : styles.buttonDanger,
          ]}
          onPress={toggleAudio}>
          <Text style={styles.buttonText}>
            Audio {isAudioOn ? 'On' : 'Off'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal Form */}
      <Modal transparent visible={showModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Join Room</Text>
            <TextInput
              style={styles.input}
              placeholder="Room Name"
              placeholderTextColor="#ccc"
              value={roomName}
              onChangeText={setRoomName}
            />
            <TextInput
              style={styles.input}
              placeholder="User"
              placeholderTextColor="#ccc"
              value={userName}
              onChangeText={setUserName}
            />
            <TouchableOpacity
              disabled={isLoading}
              style={styles.joinButton}
              onPress={handleJoin}>
              <Text style={styles.joinButtonText}>Join</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Active Speakers styles
  activeSpeakersContainer: {
    position: 'absolute',
    left: 20,
    top: 40,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    padding: 10,
    maxWidth: '60%',
  },
  activeSpeakerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeSpeakerIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  activeSpeakerText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  noSpeakersText: {
    color: '#ccc',
    fontStyle: 'italic',
  },
  // Button styles
  buttonContainer: {
    position: 'absolute',
    top: 40,
    right: 20,
    flexDirection: 'column',
    gap: 10,
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  buttonSuccess: {
    backgroundColor: 'rgba(76,175,80,0.8)',
  },
  buttonDanger: {
    backgroundColor: 'rgba(244,67,54,0.8)',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    marginBottom: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  input: {
    width: '100%',
    backgroundColor: '#333',
    color: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  joinButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
