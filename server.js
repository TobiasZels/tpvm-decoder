// Source: https://medium.com/@likovalevl/video-streaming-with-javascript-the-easy-way-45ecd7ec3f08
// Last Opened: 18.01.2024

const fs = require('fs')
const path = require('path');

const bodyParser = require('body-parser')

const express = require('express')
const fileUpload = require('express-fileupload')
const app = express()
const ProgressBar = require('progress')

// SSL for Https needed to access camera of non localhost device
const https = require('https');
const privateKey  = fs.readFileSync('keys/server.key', 'utf8');
const certificate = fs.readFileSync('keys/server.crt', 'utf8');
const credentials = {key: privateKey, cert: certificate};

const httpsServer = https.createServer(credentials, app);

// Using crypto library to create random payloads for the study
const crypto = require("crypto");

// Socket.io for dataexchange
const { Server: SocketIoServer} = require('socket.io');
const io = new SocketIoServer(httpsServer,{
    connectionStateRecovery: {
      // the backup duration of the sessions and the packets
      maxDisconnectionDuration: 2 * 60 * 1000,
      // whether to skip middlewares upon successful recovery
      skipMiddlewares: false,
    }
  });

const port = 3001 // Server Port to acess the application
var localChunk = 0 // There is a problem of video data getting lost so we only consider videos that arrived as chunk counts

//#### Study ####
// Set studyMode to true to run the automated study script iterating through every scenario defined below
// Additionaly the studyScript.py needs to run on the TPVM pc in order to sync the scenarios automaticly 
// studyScript.py can be found under /client
const studyMode = true;

// Scenarios used for the Study 
const payloads = ['2Byte', '20Bytes', '200Bytes']; 
const marker = ['aruco', 'dotcode', 'qr'];
const scenario = ['text_dark', 'text_light', 'image'];

const lighting = ['dark', 'light'];
const degree = ['0', '15', '30', '45', '60', '75'];
const distance = ['close', 'medium', 'far'];

const repitition = 5;
const cutoffTime = 5; // Stop upload after amount in seconds

// calculate the max test iterations to display progress bar
const MAX_TEST_ITERATIONS = payloads.length * marker.length * scenario.length * repitition;
var currentIteration = 0;

// IMPORTANT 
// Lightning, distance and angle of each test can't be automaticly adjusted so make sure to change these values after each run depending 
// on real life changes. First run is [0, 0, 0] coresponding to ['dark', '0', 'close']
const manualLighting = 0;
const manualDegree = 0;
const manualDistance = 0;

// Describes the position of each varibale as an array
var testArray = [manualDegree, manualDistance, manualLighting, 0, 0, 0] 

var payload = "";
var activeRepetition = 0;
var errorFlag = false;
var dataSavedToFile = true;
// #### ####

// Serve the website as static html
app.use( '/' , express.static(path.join(__dirname )));

app.use(bodyParser.urlencoded())
app.use(bodyParser.json())
app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: '/tmp/'
}))


// ### REST API ###
// Uploading file with put to reduce the load on socket io, in hope of less disconnects
app.put('/upload', (req, res) => {
    const file = req.files.file
    const [dirname, filename] = studyMode ? makeDirnameFilenameStudy(req.body.chunk) : makeDirnameFilename(socket.id, req.body.chunk);
    localChunk = req.body.chunk;

    fs.promises.mkdir(dirname, {recursive: true})
        .then(
            file.mv(filename)
        )

    fs.writeFile(dirname + "/payload.txt", payload, {}, ()=>{})

    res.statusCode = 200
    res.setHeader('Content-Type', 'text/plain')
    res.end('Upload\n')
})
// ### ### 



// Socket connection
io.on('connection', function (socket) {
    console.log("new device connected.. " + socket.id);

    // Handles the upload of files to the server
    /* The "upload" section will get handled client sided for now else its too hard to keep everything in sync
    socket.on('upload', function (data){
        //const [dirname, filename] = studyMode ? makeDirnameFilenameStudy(localChunk) : makeDirnameFilename(socket.id, localChunk);

        // Save video to the disk
        // Replaced by the rest function above to prevent disconnects in socket io
        /*
        fs.promises.mkdir(dirname, {recursive: true})
            .then(()=>{
                buffer = new Buffer(data.file)
                fs.writeFile(filename, buffer, {}, ()=>{})

                // Saves a text with the payload into the folder
                fs.writeFile(dirname + "/payload.txt", payload, {}, ()=>{})
            });
        

        //localChunk++;

        // Automaticly stop after cutoffTime seconds to send chunks to wait for the server to process them first before uploading more
        /*if(localChunk >= cutoffTime - 1){ // cutoffTime needs to be -1 if we let the client count, cause it will send one more video after "stop_upload"
            socket.emit("stop_upload", "")
            localChunk = 0
        }
        

    }) */

    // TODO: Rename this function
    // Handles the scanning workflow
    socket.on("study_start", async () => {
        socket.emit('code-scanned', "Starting Study!"); 

        // In studyMode the scanning repeats automatic for each defined scenario above
        if(studyMode){
            automaticScanning(socket);
        }
        else{
            manualScanning();
        }
    })

    // Recieves the total time per attempt and writes it to a csv file
    socket.on("send_timer", (timer) =>{
        writeToCsv(timer);
    })

});



// Automaticly repeat the scanning of codes for each defined scenario
const automaticScanning = async (socket) =>{
    activeRepetition = 0;
    currentIteration = 0;
    var processDone = true;
    var end = true;
    var payloadsNumber = 0;
    var markerNumber = 0;
    var scenarioNumber = 0;

    // create a Progress Bar for visuals
    // Source: https://dev.to/andrewallison/nodejs-console-progress-bar-704
    // Last Opened: 21.01.2024
    const bar = new ProgressBar('-> Processing [:bar] :percent :etas', {
        total: MAX_TEST_ITERATIONS,
        width: 30,
      });

    nonBlockingForLoop();

    // Repeat everything for each repetition using functions istead of loops to not block the application
    function nonBlockingForLoop(){
        // Make sure to only count up once the while loop is done
        if(end && dataSavedToFile){
            end = false;
            payloadsNumber = 0;
            markerNumber = 0;
            scenarioNumber = 0;
            activeRepetition++;
            payload = randomizePayload(1);
            mainLoop();
        }

        // Repeat everythng for each scenario
        async function mainLoop(){
            // Make sure to start the next run only after the last run got saved to disc
            if(dataSavedToFile && processDone){
                // Broadcasts the used payload
                socket.broadcast.emit("payload", payload);
                processDone = false;
                testArray = [manualDegree, manualDistance, manualLighting, payloadsNumber, markerNumber, scenarioNumber];

                socket.broadcast.emit("set_scenario", testArray); // Sends the scenario to the test pc
                socket.emit('code-scanned', "Running " + scenario[scenarioNumber] + " using " + marker[markerNumber] + " Marker with "+ payloads[payloadsNumber] + " Payload! Run: " + activeRepetition); 

                socket.emit("start_upload", ""); // Signals the phone to start uploading the files

                // Source: https://stackoverflow.com/a/47655913
                // Last Opened: 18.01.2024
                let runPy = new Promise(function(success, nosuccess) {

                    const { spawn } = require('child_process');
                    const pyprog = spawn('python', ['decode.py', marker[markerNumber], makeDirnameFilenameStudy("")[0]]);
                
                    pyprog.stdout.on('data', function(data) {
                        success(data);
                    });
                
                    pyprog.stderr.on('data', (data) => {
                        nosuccess(data);
                        processDone = true;
                        throw new Error(data);
                    });
                });
                
                // Runs decode.py and returns the output of it to the fromRunpy variable
                // decode.py outputs the payload of the decoded marker if it finds one else it ouputs error 
                runPy.then(function(fromRunpy) {
                    // Handles the error to not consider it as valid marker payload
                    if(!fromRunpy.toString().includes("error")){
                        socket.emit("study_end", "")
                        processDone = true;
                    }
                    else if (fromRunpy.toString().includes("error")){
                        errorFlag = true;
                        socket.emit("study_end", "")
                        processDone = true;
                    }
                }).catch((error)=>{
                    console.log(error);
                });

                // Marks that data needs to be saved before continue
                dataSavedToFile = false;
                scenarioNumber++;
                currentIteration++;
                bar.tick(1);

                // Iterate through the scenarios
                if(scenarioNumber >= scenario.length){
                    scenarioNumber = 0;
                    markerNumber++;
                    if(markerNumber >= marker.length){
                        markerNumber = 0;
                        payloadsNumber++;
                        payload = payloadsNumber == 1 ? randomizePayload(10) : randomizePayload(100);
                    }
                }


                // Stop when all the scenarios are done
                if(payloadsNumber >= payloads.length){
                    end = true;
                }
            }
            // Prevents the mainLoop from blocking the Server
            if(!end){
                setTimeout(mainLoop);
            }
        }
        if(activeRepetition < repitition){
            setTimeout(nonBlockingForLoop);
        }
        else{
            socket.emit('code-scanned', "Run Done!"); // Signals that the run finished
        }
    }

}

// TODO: Handle the manual scanning process
const manualScanning = () => {

}

// Example folder structure of first file: 0-close-dark-1Byte-aruco-text_dark-0/0.webm
const makeDirnameFilenameStudy = (chunk) => {
    const dirname = path.join(__dirname + `/uploads/${degree[testArray[0]]}-`+
                                                    `${distance[testArray[1]]}-` +
                                                    `${lighting[testArray[2]]}-` +
                                                    `${payloads[testArray[3]]}-` +
                                                    `${marker[testArray[4]]}-` +
                                                    `${scenario[testArray[5]]}-` +
                                                    `${activeRepetition}`)
    const filename = `${dirname}/${chunk}.webm`
    return [dirname, filename]
}

// Example folder structure of first file: ojIckSD2jqNzOqIrAGzL/0.web
const makeDirnameFilename = (id, chunk) => {
    const dirname = path.join(__dirname + `/uploads/${id}`)
    const filename = `${dirname}/${chunk}.webm`
    return [dirname, filename]
}

// Writes the timer to a csv file to track the study
const writeToCsv = (timer) =>{
    // Csv format is same as folder with added timer and an error flag so:
    // angle; distance; lighting; payload; marker; scenario; repetition; timer; error
    const data =   `${degree[testArray[0]]};` +
                    `${distance[testArray[1]]};` +
                    `${lighting[testArray[2]]};` +
                    `${payloads[testArray[3]]};` +
                    `${marker[testArray[4]]};` +
                    `${scenario[testArray[5]]};` +
                    `${activeRepetition};` +
                    `${timer};` +
                    `${errorFlag.toString()}\r\n`

    fs.appendFile('results.csv', data, function(err){
        if (err) throw err;
        dataSavedToFile = true; // signals data got saved to file and the next run can start
        // errorFlag = false;

    });
    
}

// Function to randomize the payload 
const randomizePayload = (payloadSize) =>{
    return crypto.randomBytes(payloadSize).toString('hex');
}

// Start the Webserver
httpsServer.listen(port, function () {
    console.info("Websever running on Port %d", port);
});