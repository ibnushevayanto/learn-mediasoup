import "./style.css";
import buttons from "./uiStuff/uiButtons";
import { io } from "socket.io-client";
import { Device } from "mediasoup-client";
import getMic2 from "./getMic2";
import createProducerTransport from "./mediaSoupFunctions/createProducerTransport";
import createProducer from "./mediaSoupFunctions/createProducer";
import requestTransportToConsume from "./mediaSoupFunctions/requestTransportToConsume";

let device = null;
let localStream = null;
let producerTransport = null;
let videoProducer = null;
let audioProducer = null; //THIS client's producer
let consumers = {}; //key off the audioPid

// const socket = io.connect('https://localhost:3031')
//FOR LOCAL ONLY... no https
const socket = io.connect("http://192.168.0.16:3031");
socket.on("connect", () => {
  console.log("Connected");
});

socket.on("updateActiveSpeakers", async (newListOfActives) => {
  // console.log("updateActiveSpeakers")
  // console.log(newListOfActives)
  // an array of the most recent 5 dominant speakers. Just grab the 1st
  // and put it in the slot. Move everything else down
  // consumers is an {} with key of audioId, value of combined feed
  console.log(newListOfActives);
  let slot = 0;
  // remove all videos from video Els
  const remoteEls = document.getElementsByClassName("remote-video");
  for (let el of remoteEls) {
    el.srcObject = null; //clear out the <video>
  }
  newListOfActives.forEach((aid) => {
    if (aid !== audioProducer?.id) {
      // do not show THIS client in a video tag, other than local
      // put this video in the next available slot
      const remoteVideo = document.getElementById(`remote-video-${slot}`);
      const remoteVideoUserName = document.getElementById(`username-${slot}`);
      const consumerForThisSlot = consumers[aid];
      remoteVideo.srcObject = consumerForThisSlot?.combinedStream;
      remoteVideoUserName.innerHTML = consumerForThisSlot?.userName;
      slot++; //for the next
    }
  });
});

socket.on("newProducersToConsume", (consumeData) => {
  // console.log("newProducersToConsume")
  // console.log(consumeData)
  requestTransportToConsume(consumeData, socket, device, consumers);
});

const joinRoom = async () => {
  // console.log("Join room!")
  const userName = document.getElementById("username").value;
  const roomName = document.getElementById("room-input").value;
  const joinRoomResp = await socket.emitWithAck("joinRoom", {
    userName,
    roomName,
  }); // 1.1 Run joinRoom socket.io event, send up userName and roomName

  // console.log(joinRoomResp)
  device = new Device();
  await device.load({
    routerRtpCapabilities: joinRoomResp.routerRtpCapabilities,
  }); // 3.1  Load device

  // console.log(device)
  console.log(joinRoomResp);
  // joinRoomResp contains arrays for:
  // audioPidsToCreate
  // mapped to videoPidsToCreate
  // mapped to usernames
  //These arrays, may be empty... they may have a max of 5 indicies
  requestTransportToConsume(joinRoomResp, socket, device, consumers); // 3.2 Eventually, start building transports for current producers

  buttons.control.classList.remove("d-none"); // 3.3 Display control buttons
};

const enableFeed = async () => {
  // const mic2Id = await getMic2() //this is for me!
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
    // audio: {deviceId:{exact:mic2Id}}, //this is for me!
  }); // 4.1 getUserMedia

  buttons.localMediaLeft.srcObject = localStream; // 4.2 add video to local video box
  buttons.enableFeed.disabled = true; // 4.3 Enable control buttons
  buttons.sendFeed.disabled = false;
  buttons.muteBtn.disabled = false;
};

const sendFeed = async () => {
  //create a transport for THIS client's upstream
  // it will handle both audio and video producers
  producerTransport = await createProducerTransport(socket, device); // 5.2 Request/create a transport for THIS client's upstream | 5.3 Wait for server to send back params

  // console.log("Have producer transport. Time to produce!")
  // Create our producers
  const producers = await createProducer(localStream, producerTransport);
  audioProducer = producers.audioProducer;
  videoProducer = producers.videoProducer;
  console.log(producers);
  buttons.hangUp.disabled = false;
};

const muteAudio = () => {
  // mute at the producer level, to keep the transport, and all
  // other mechanism in place
  if (audioProducer.paused) {
    // currently paused. User wants to unpause
    audioProducer.resume();
    buttons.muteBtn.innerHTML = "Audio On";
    buttons.muteBtn.classList.add("btn-success"); //turn it green
    buttons.muteBtn.classList.remove("btn-danger"); //remove the red
    // unpause on the server
    socket.emit("audioChange", "unmute");
  } else {
    //currently on, user wnats to pause
    audioProducer.pause();
    buttons.muteBtn.innerHTML = "Audio Muted";
    buttons.muteBtn.classList.remove("btn-success"); //turn it green
    buttons.muteBtn.classList.add("btn-danger"); //remove the red
    socket.emit("audioChange", "mute");
  }
};

buttons.joinRoom.addEventListener("click", joinRoom);
buttons.enableFeed.addEventListener("click", enableFeed);
buttons.sendFeed.addEventListener("click", sendFeed); // 5.1 Create sendFeed function and listener
buttons.muteBtn.addEventListener("click", muteAudio);
