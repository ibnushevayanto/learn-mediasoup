
const createProducer = (localStream, producerTransport)=>{
    return new Promise(async(resolve, reject)=>{
        //get the audio and video tracks so we can produce

        // 8.1 Get video and audio tracks from stream
        const videoTrack = localStream.getVideoTracks()[0]
        const audioTrack = localStream.getAudioTracks()[0]
        try{
            // running the produce method, will tell the transport 
            // connect event to fire!!
            // 8.2 Start producing both!
            console.log("Calling produce on video")
            const videoProducer = await producerTransport.produce({track:videoTrack})
            console.log("Calling produce on audio")
            const audioProducer = await producerTransport.produce({track:audioTrack})
            console.log("finished producing!")
            resolve({audioProducer,videoProducer})
        }catch(err){
            console.log(err,"error producing")
        }
    })
}

export default createProducer
