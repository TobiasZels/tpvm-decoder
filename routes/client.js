//#######################
//#     Client Route    #
//#######################


//##################
//#     Imports    #
//##################
const express = require('express');
const router = express.Router();
const crypto = require("crypto");
const fs = require('fs')

const database_helper = require('../helper/database_helper')
const image_decoder = require('../helper/image_decoder')
const websocket_helper = require('../helper/websocket_helper')


const OperationSchema = require("../schema/operations.js").OperationSchema;
const DeviceSchema = require("../schema/devices.js").DeviceSchema;


//#######################
//#     Get Requests    #
//#######################

//########################
//#     Post Requests    #
//########################

// Post request to register a Device
router.post('/register', async(req, res, next)  =>{
    let device = await database_helper.selectFromDatabase(DeviceSchema, 'address', req.body.address);
    if(!device){
        await database_helper.insertIntoDatabase(DeviceSchema, req.body);
        device = await database_helper.selectFromDatabase(DeviceSchema, 'address', req.body.address)
    }
    res.json(device);
})

// Post request to delist a Device
router.post('/delist', async(req, res, next)  =>{
    let device = await database_helper.deleteFromDatabase(DeviceSchema, 'address', req.body.address);
    res.json("success");
})

// Post request to upload an Image
router.post('/upload', async(req, res, next)  =>{
    var base64Data = req.body.data.replace(/^data:image\/png;base64,/, '');
    var img = Buffer.from(base64Data, 'base64');
    var imageName = crypto.randomUUID();
    fs.writeFile('./uploads/' + imageName + ".png" , img, async function(err){
        if(err){ console.log(err);}
    });

    image_decoder.registerImage(imageName);
    res.json(imageName);
})

// Post request to return image results
router.post('/results', async(req, res, next)  =>{
    console.log(req.body);
    image_decoder.returnResults(req.body.imageName, req.body.marker);
    res.json("success");
})

module.exports = router;