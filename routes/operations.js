//###########################
//#     Operations Route    #
//###########################


//##################
//#     Imports    #
//##################
const express = require('express');
const router = express.Router();

const database_helper = require('../helper/database_helper.js')
const websocket_helper = require('../helper/websocket_helper.js')

const OperationSchema = require("../schema/operations.js").OperationSchema;
const DeviceSchema = require("../schema/devices.js").DeviceSchema;


//#######################
//#     Get Requests    #
//#######################

//########################
//#     Post Requests    #
//########################

// Post request to register a Operation
router.post('/register', async(req, res, next)  =>{
    let operation = await database_helper.selectFromDatabase(OperationSchema, ['device_id', 'window_name'], [req.body.device_id, req.body.window_name]);
    if(!operation){
        await database_helper.insertIntoDatabase(OperationSchema, req.body);
        operation = await database_helper.selectFromDatabase(OperationSchema, 'call_id', req.body.call_id)
    }

    res.json(operation);
})

// Post request to delist a Operation
router.post('/delist', async(req, res, next)  =>{
    let operation = await database_helper.deleteFromDatabase(OperationSchema, 'call_id', req.body.call_id);
    res.json("success");
})

// Post request to start a Function
router.post('/start', async(req, res, next)  =>{

    let operation = await database_helper.selectFromDatabase(OperationSchema, ['device_id', 'window_name'], [req.body.marker.split('-')[0], req.body.marker.split('-')[1]]);
    websocket_helper.runOperation(operation.call_id);

    res.json("success");
})

module.exports = router;