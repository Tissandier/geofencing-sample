/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2015. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';

var express    = require('express'),
    bodyParser = require('body-parser'),
    lib        = require('@pi/common-lib'),
    path        = require('path');


var SERVICE_TAG = lib.constants.conf.actors.esgeofences.SERVICE_TAG;

//middleware
var middleware = lib.middleware;

//routes
var router = new express.Router();

router.use(bodyParser.json());
//esRouter.use(middleware.logger(SERVICE_TAG));

router.get('/', function(req, res){
    res.status(200).send(SERVICE_TAG + ': is up and running!');
});



exports = module.exports = router;
