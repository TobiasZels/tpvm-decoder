// Source: https://medium.com/@likovalevl/video-streaming-with-javascript-the-easy-way-45ecd7ec3f08
// Last Opened: 18.01.2024

//##################
//#     Imports    #
//##################

const fs = require('fs')
const path = require('path');

const bodyParser = require('body-parser')
const fileUpload = require('express-fileupload')
const express = require('express')
const https = require('https');

// Using crypto library to create random payloads for the study
const crypto = require("crypto");

// Socket.io for data exchange
const { Server: SocketIoServer} = require('socket.io');

// Custom modules
const database_helper = require('./helper/database_helper');
const websocket_helper = require('./helper/websocket_helper');
//#######################
//#     Declarations    #
//#######################

const app = express()

// SSL for Https needed to access camera of non localhost device
const privateKey  = fs.readFileSync('keys/server.key', 'utf8');
const certificate = fs.readFileSync('keys/server.crt', 'utf8');
const credentials = {key: privateKey, cert: certificate};

// Create the webserver with socketio
const httpsServer = https.createServer(credentials, app);
const io = new SocketIoServer(httpsServer,{
    connectionStateRecovery: {
      // the backup duration of the sessions and the packets
      maxDisconnectionDuration: 2 * 60 * 1000,
      // whether to skip middlewares upon successful recovery
      skipMiddlewares: false,
    }
  });

websocket_helper.registerSocket(io);

const port = 3002 // Server Port to access the application

database_helper.initializeDatabase();

// Check if the table exists
database_helper.checkTables();

// Serve the HTML website as static html
app.use( '/' , express.static(path.join(__dirname + "/public")));

//app.use(bodyParser.urlencoded())
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: '/tmp/'
}))

//#####################
//#     API  Routes   #
//#####################

app.use('/api/client', require('./routes/client'));
app.use('/api/operation', require('./routes/operations'));



// STUDY CODE:
app.get('/data/:id', (req, res) => {
    res.send('data from ' + req.params.id + ' about ' + req.query.window)
})


//###############################
//#     Socket IO Connection    #
//###############################


// On Device Connection
io.on('connection', function (socket) {
    
    console.log("new device connected.. " + socket.id);
    socket.on("disconnect", (reason) => {
        console.log(reason);
    })

}) 

// Start the Webserver
httpsServer.listen(port, function () {
    console.info("Websever running on Port %d", port);
});