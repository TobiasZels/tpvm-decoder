//##################
//#     Imports    #
//##################


//###############################
//#     Websocket Functions     #
//###############################
let io = null;


function registerSocket(socket){
    io = socket
}

function notifyDecoder(imageName){
    io.emit("startImageProcess", imageName);
}

function notifySmartphone(imageName, marker)
{
    io.emit("imageProcessed", [imageName, marker]);
}

function runOperation(call_id)
{
    io.emit("runOperation", call_id)
}

module.exports = {registerSocket,notifySmartphone, notifyDecoder, runOperation};
