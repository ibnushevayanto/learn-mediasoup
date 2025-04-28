# Video Conferencing Task List
## user clicks on joinRoom (1)
1. Run joinRoom socket.io event, send up userName and roomName
### server gets joinRoom event (2)
1. Make client
2. If room does not exist
- get a worker
- create new room with it's own router
- add new room to master rooms array
3. Add this client to the room (whether it's new or not)
4. Add the room to the client object for convenience
5. Add this socket to the socket.io room for communication
6. Eventually, we will need to get all current producers... come back to this!
7. Send back routerCapabilities, and speakers/producers

### client gets joinRoom response (3)
1. Load device
2. Eventually, start building transports for current producers
3. Display control buttons

## user clicks feedOn button (4)
1. getUserMedia
    - Note: I have to pull 2nd mic, you do not
2. add video to local video box
3. Enable control buttons

## user clicks on sendFeed button (5)
1. Create sendFeed function and listener
2. Request/create a transport for THIS client's upstream
    - It wil handle both an audio producer and a video producer
    - Abstract to a createProducerTransport function
3. Wait for server to send back params
### server gets requestTransport event (6)
1. Prepare for both consumer and producer requests
2. Reuse createWebRtcTransportBothKinds (ugh!) from theBasics project
    - Put this in our Client class as a method
3. Add a few new details into it
4. Add new transport to the right part of our Client object
5. Respond with our clientTransportParams
### front-end recieves params from server (7)
    - Create sendTransport with params
    - Listen for connect 
        - emit connectTransport on connect
        - Move forward on success
    - Listen for produce
        - Emit startProducer to server
        - Move forward on success
### On transport created, create producer (8)
1. Get video and audio tracks from stream
2. Start producing both!

## The Hard/Confusing Part - Dominant Speaker & Consumers... who and when?
- DO NOT BE INTIMIDATED! ONE TASK AT A TIME!
- If you want to scale, you have to take this part seriously.
### Consuming:
- There are two primary use cases for a client to start consuming:
1. A new client joins and there are already producers.
2. A new client starts producing, and there are exisiting clients.
### Dominant Speaker:
- We will grab the 5 most recent dominant speakers. There are three occasions why this would change: 
1. A new person becomes the dominant speaker.
    - This may require a new transport if the new speaker has moved into the top 5 for the first time since a given client has joined
    - This may just require unpausing a producer if the client has consumed the producer before and it has moved back into the top
2. A new person starts producing and there are less than 5 in the list.
    - This ALWAYS means creating a new transport for all clients.
3. A person hangs up who was in the top 5
    - Terminate transports/consumers

## Continued: Tasklist for Consuming and Updating 
### When a client joins a room:
- We handle Consuming 1
### When a new client starts producing:
- We handle consuming 2 and Dominant Speaker 2
### When a new person is identified as dominant speaker:
- We handle Dominant Speaker 1
### When a client hangs up
- We handle Dominant Speaker 3
### If clients are consuming a producer that falls out of the top 5, stop.

### Front-end will get a list of all new producers to consume:
1. on joinRoom
2. if the server alerts

## Dominant Speaker Tasklist:
1. Add an activeSpeakerObserver to the room router
2. listen for the dominantspeaker event
3. when a new producer is added, add it to the observer
4. on dominantspeaker event, move that id to the front of that room's activeSpeakerList
5. alert all sockets in that room (leads to next bullet point!)
### Alerting sockets tasklist:
- This will be used for new dominant speaker OR if a new producer appears and there are less than 5 producers
1. Grab the most recent 5 speakers in activeSpeakerList as current
2. Grab all other known speakers as muted
3. Loop through ALL clients in this room
    - Loop through all clients to mute, calling iteration pid
        - Find any producer that is not in the top 5 and pause
        - If client has a consumer that matches pid, mute
        - If client does not have a consumer that matches pid, do nothing
    - Create an array to handle a new speaker to the current client
    - Loop through currentSpeakers (top 5)
        - Resume the producer
        - If client has a consumer that matches pid, unpause
            - This happens because it has consumed before and paused
        - If no match, and NOT this user, add to newSpeaker array to prepare to create a transport to consume
    - If there are any pids in newSpeaker array for THIS client, add them to be processed outside of loop
4. Client loop is done, emit to all connected sockets to this room the new top 5 so front-end can update
5. Emit to each client who has at least one new transport, the list of producers to start transport/consuming
- We are storing the audio pid in activeSpeakerList, so that's what we'll have
- We need to get the cooresponding video pid and the userName for the front-end

## Consume on joinRoom
### Server side: joinRoom socket event
1. Get up to the 5 most recent speakers from activeSpeakerList
2. Map through room clients to find the cooresponding video pid
3. Map through room clients to find the cooresponding username (can combine with above)
4. Send back these 3 arrays
### Front end: requestTransportsToConsume
1. Loop through audio pids
2. For each one, emit requestTransport event
    - Update server requestTransport
### Server: consumer transport
1. Update requestTransport to include videoPid
2. Update Client addTransport method for consumer
    - Note the downstreamTransports 3 properties
    1. transport
    2. associatedProducerAudioPid
    3. associatedProducerVideoPid
### Front-end: Create transport with params
- Same as producer, but a separate file
1. createRecvTransport on device with params
2. Optionally add listeners
3. on.connect listener
    - Triggers on .consume()
4. return the newTransport
### Consume!
1. New file for createConsumer
2. emit consumeMedia to server
### Server: consumeMedia
1. Confirm we can consume with canConsume
2. Find the transport from the consuming client's downstreamTransports
3. Run consume!
4. addConsumer method in Client
5. Get and send back consumerParams to front-end
### Front-end: consume, connect, load video!
- Note: Follow the process
1. Handle consumerParams error responses
2. Consume 
3. Emit connectTransport in the connect event.
4. callback or errback
5. Get track (back in createConsumer)
6. Unpause
7. Combine streams and add to video tag!

## On new producer, with populated room
### updateActiveSpeakers function
- See above: Alerting sockets tasklist
- We have finally reached our final task!
- If user has never spoken, but sending feed, add?