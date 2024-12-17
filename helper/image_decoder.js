//##################
//#     Imports    #
//##################

const websocket_helper = require('../helper/websocket_helper');


//####################################
//#     Image Decoding Functions     #
//####################################
let imageList = [];
let inProcess = false;

// Function to register an Image in the pipeline
function registerImage(imageId){
    imageList.push(imageId);
    decodeImage();
}

// Function to start the decoding of an Image
function decodeImage(){
    if(!inProcess && imageList.length > 0){
        inProcess = true;
        websocket_helper.notifyDecoder(imageList[0]);
        imageList.splice(0, 1);
    }
}

// Function to notify Smartphone about decoding results
function returnResults(imageName, marker){
    inProcess = false;
    websocket_helper.notifySmartphone(imageName, marker)
    decodeImage();
}

module.exports = {registerImage, returnResults};
