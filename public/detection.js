const video = document.querySelector('video');

var qr_value = " ";

let requestOpen = false;
let imageId = "";

const socket = io();

// Listen to changes to the unique image id
socket.on("imageProcessed", ([id, marker]) => {
    if(imageId.includes(id)){
        setMarker(marker);
        requestOpen = false;
    }
})

document.getElementById('close').onclick = function() {
    document.getElementById('controlls').style.visibility = "hidden";
};

function setMarker(data){
    document.getElementById('detection').innerHTML = data;
    qr_value = data;
    document.getElementById('controlls').style.visibility = "visible";
}

document.getElementById('controlls').onclick = function() {
    var str = qr_value + '';
    fetch('/api/operation/start', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({marker: str})
    })
    //window.open("https://localhost:3002/data/" +values[0] + "?window=" + values[1]);
};


// Load Roboflow Model -> pretrained QR-Code YOLO model in this case
async function loadModel(){
    var model = await roboflow.auth({
        publishable_key: "rf_NtcZ493wS2P2w7HH5VKR54FfNnh2",
    }).load({
        model: "qr-code-ee1km",
        version: 3 // <--- YOUR VERSION NUMBER
    });

    return model;
}

var initialized_model = loadModel();

// Check if browser has api for the media
function permittedGetUserMedia(){
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}


// Wait for OpenCV to initialize 
cv['onRuntimeInitialized']=()=>{

    // Wait for the YOLO model to initialize
    initialized_model.then( (model) => {
            
        console.log("Model loaded!")
        var src = null;
        var dst;
        let cap;

        const FPS = 30;

        // Function that detects Marker in the Video 
        function processVideo() {

            // Canvas needed for OpenCV
            var canvas = document.getElementById('canvasOutput');
            var canvasROI = document.getElementById('canvasROI');

            try {
                if(!src){
                    // Set the dimensions and start the capture
                    src = new cv.Mat(video.videoHeight, video.videoWidth, cv.CV_8UC4);
                    dst = new cv.Mat();
                    video.height = video.videoHeight;
                    video.width = video.videoWidth;
                    cap = new cv.VideoCapture(video);
                }

                // If src is still not set then something went wrong so we clean up and exit this loop
                if (!src) {
                    src.delete();
                    dst.delete();
                    return;
                }

                // Start the timer
                let begin = Date.now();

                // Read a frame and start the processing
                cap.read(src);

                // Make sure that only one requests gets handled at one time
                if(!requestOpen){
                    cv.imshow('canvasOutput', src);

                    // Run the Yolo Model over the frame and detect a marker
                    model.detect(canvas).then(function(predictions) {

                        // Each prediction of the model is a possible marker so iterate through them all
                        predictions.forEach(boxes => { 
                            // Get the border box from the prediction and calculate the the x and y coordinate of the top left corner
                            var box = boxes.bbox;
                            x = box.x -box.width/2;
                            y = box.y -box.height/2;

                            var width = box.width;
                            var height = box.height;

                            // Create a rectangle with a 20px offset on each side in order to get a better border for the marker
                            offsetX = x - 20;
                            offsetY = y - 20;
                            offsetWidth = width + 40;
                            offsetHeight = height + 40;
                            let rect = new cv.Rect(offsetX, offsetY, offsetWidth, offsetHeight);

                            // Make sure the Marker is in the VideoFrame and get the roi
                            if(offsetX > 0 && offsetY > 0){
                                if(offsetX+offsetWidth < video.videoWidth && offsetY+offsetHeight < video.videoHeight){
                                    dst = src.roi(rect);    

                            
                                    cv.imshow('canvasROI', dst);

                                    // Get the Marker from the Canvas
                                    const data = canvasROI.toDataURL();
                    
                                    // Upload the Marker to the Webserver
                                    //requestOpen = true
                                    setMarker("Marker wird decoded, bitte warten...")
                                    fetch('/api/client/upload', {
                                        method: 'POST',
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({data: data })
                                    }).then(response => response.text())
                                    .then(data => {
                                        imageId = data;
                                    });
                                    requestOpen = true;

                                    QrScanner.scanImage(canvasROI, { returnDetailedScanResult: true })
                                    .then(result => {
                                        qr_value = result.data;
                                        document.getElementById('detection').innerHTML = result.data;
                                        document.getElementById('controlls').style.visibility = "visible";
                                        requestOpen = false;
                                        })
                                    .catch(error => console.log(error || 'No QR code found.'));
                                }
                            }
                                 
                        });  
                    }).catch(e =>{
                        console.log(e);
                    });
                }

                // schedule the next Frame depending on the Framerate (standard 30 fps for detection).
                let delay = 1000/FPS - (Date.now() - begin);
                setTimeout(processVideo, delay);
            } catch (err) {
                console.log(err)
            }
        };
        
        // Start the video streaming of the user camera if its permitted by the user
        if (permittedGetUserMedia()){
            const mediaSource = getMediaSource();
            video.src = URL.createObjectURL(mediaSource);

            // Get the video from the user and stream it to the server
            navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    aspectRatio: {ideal: 16/9},
                    //width: { ideal: 1920 }, //4096
                    //height: { ideal: 1080 },  //2160
                    //frameRate: {ideal: 60}
                }
            }).then ((stream) => processStream(stream));
        }

        function processStream(stream){
            video.srcObject = stream;

            video.onloadedmetadata = ()=> {
                setTimeout(processVideo, 0);
            }
        }

        // Problems on Safari with the difference of MediaSource and ManagedMediaSource, so check which one is the right one for the current
        // browser
        function getMediaSource() {
            if (window.ManagedMediaSource) {
                return new window.ManagedMediaSource();
            }
            if (window.MediaSource) {
                return new window.MediaSource();
            }

        }
    });
}