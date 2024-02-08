// Source: https://medium.com/@likovalevl/video-streaming-with-javascript-the-easy-way-45ecd7ec3f08

// Socket io
const socket = io();
const MAX_VIDEO_PER_ITERATION = 5;

var started = false;
var mediaRecorder;
var start;
var end
var countUploadChunk = 0;

var mainButton = document.getElementById("mainButton")

// End the current run and send the time elapsed back
socket.on("study_end", () =>{
    started = false;
    end = Date.now();
    socket.emit("send_timer",  end - start );
    mainButton.style.visibility = "visible";
})


// Start the timer for the current run
socket.on("start_upload", () =>{
    mainButton.style.visibility = "hidden";
    start = Date.now();
    started = true;
    countUploadChunk = 0;
})

// Stop uploading new videos
socket.on("stop_upload", () =>{
    started = false;
})

// Start the video streaming of the user camera if its permitted by the user
if (permittedGetUserMedia()){
    const mediaSource = getMediaSource();
    
    // Get the video from the user and stream it to the server
    navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: 'environment',
            aspectRatio: 16/9,
            width: { ideal: 720 }, //4096
            height: { ideal: 480 },  //2160
            frameRate: {ideal: 30, max: 30}

        }
    }).then ((stream) => processStream(stream, mediaSource));
}

// Displays a message on the detection textbox
socket.on('code-scanned', function (code) {
    document.getElementById('detection').innerHTML = code;
});

// ### Functions ###
// Problems on Safari with the difference of MediaSource and ManagedMediaSoure, so check whcih one is the right one for the current
// browser
function getMediaSource() {
    if (window.ManagedMediaSource) {
        return new window.ManagedMediaSource();
    }
    if (window.MediaSource) {
        return new window.MediaSource();
    }

}

// Function to start the study with the button
function statButtonClick(){
    if(started){ }
    else{
        socket.emit("study_start", "")
    }
}

// Check if browser has api for the media
function permittedGetUserMedia(){
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// Function that handles the video streaming to the server
function processStream(stream, mediaSource){
    const video = document.querySelector('video');

    video.srcObject = stream;

    mediaRecorder = new MediaRecorder(stream);

    // Once Data is available (once every 1s) send it to the server
    mediaRecorder.ondataavailable = (data) =>{
        sendFile(data.data, countUploadChunk);
        countUploadChunk++;
    }

    // Start the recorder initially
    // mediaRecorder.start()


    // Loop the stop and start of the video recorder every second, so 1s video clips get send
    setInterval(() => {

        // Make sure to only stop if the mediarecorder is recording
        if(mediaRecorder.state == "recording"){
            console.log("works");
            mediaRecorder.stop()
        }

        // Check that only 5 videos get send -1 cause we start at 0 
        if(countUploadChunk >= MAX_VIDEO_PER_ITERATION - 1){
            started = false;
        }

        // start and stop needs to be seperated to prevent long recordings during processing off times
        if(started){
            mediaRecorder.start()
        }
    }, 1000);
}

// Sends the Video file to the server
function sendFile(file, chunkNumber){

    const  formData = new FormData();
    formData.append('file', file);
    formData.append('name', "");
    formData.append('chunk', chunkNumber);
    //data = {file: file, name: "", chunk: chunkNumber}

    // Using the upload endpoint
    fetch('/upload', {
        method: 'PUT',
        body: formData
    });

    // Emit that something got uploaded
    socket.emit('upload', "");
}

// ### ###