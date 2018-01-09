/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2015. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */

/* jshint mocha:true */
/* eslint vars-on-top:0, no-use-before-define:0 */

'use strict';

var expect = require('chai').expect,
    Promise = require('bluebird'),
    request = require('superagent'),
    mqlight = require('mqlight'),
    config = require('../../config'),
    processor = require('../processor.js'),
    baseUrl = 'http://localhost:9002/';

// init MQLight
var mqCredentials = config.mqlight.credentials;
var mqlightClient = mqlight.createClient({
    service  : mqCredentials.connectionLookupURI,
    user     : mqCredentials.username,
    password : mqCredentials.password
});
var mqTopic = 'geofencingSample/event';

var newGeofence = {
    type: 'Feature',
    geometry: {
        type: 'Point',
        coordinates: [
            2,4
        ]
    },
    properties: {
        name: 'test fence',
        radius: 100
    }
};

var newGeofenceCode;

var DEVICE_DESCRIPTOR1 = '072bad9d-8b76-43b1-b2f4-7b28b1e8a9dd';
var DETECTED_TIME1 = '2015-05-03T18:39:33.719Z';
var GEOFENCE_CODE1 = 'initial value'; // replaced by an actual code
var CROSSING_TYPE1 = 'enter';

var DEVICE_DESCRIPTOR2 = '8023c102-4577-4a3d-8aa7-b5078e90c29a';
var DETECTED_TIME2 = '2015-05-03T18:39:33.719Z';
var GEOFENCE_CODE2 = 'non_existing_code'; // for testing the silent skip
var CROSSING_TYPE2 = 'enter';

var DEVICE_DESCRIPTOR3 = '4db433e8-ace3-41ca-a5d8-ea765f27826a';
var DETECTED_TIME3 = '2015-05-05T11:30:33.719Z';
var GEOFENCE_CODE3 = 'initial value'; // replaced by an actual code
var CROSSING_TYPE3 = 'exit';

var inboundPayload = {
    'notifications': [
        {
            'descriptor': DEVICE_DESCRIPTOR1,
            'detectedTime': DETECTED_TIME1,
            'data': {
                'geofenceCode': GEOFENCE_CODE1,
                'crossingType': CROSSING_TYPE1
            }
        },
        {
            'descriptor': DEVICE_DESCRIPTOR2,
            'detectedTime': DETECTED_TIME2,
            'data': {
                'geofenceCode': GEOFENCE_CODE2,
                'crossingType': CROSSING_TYPE2
            }
        },
        {
            'descriptor': DEVICE_DESCRIPTOR3,
            'detectedTime': DETECTED_TIME3,
            'data': {
                'geofenceCode': GEOFENCE_CODE3,
                'crossingType': CROSSING_TYPE3
            }
        }
    ]
};

// How long we wait for output MQ messages of the processor.
// For testing purposes, we need to check all events emitted by the processor.
// This waiting delay needs to be shorter than the timeout used in the mocha test.
var WAIT_DELAY = 5000; // ms
var TEST_TIMEOUT = '40s';
var timeoutObj;

/**
 * Calls the process() method of the processor and returns a promise which resolves after
 * a given wait delay and sends an array of all received mq events for the topic used
 * by the processor. This allows to assert the messages sent by the processor.
 */
function runProcessor(msgObj, waitDelay) {
    var dfd = Promise.defer();
    var eventDataArray = [];

    mqlightClient.subscribe(mqTopic, function (err) {
        if (err) {
            dfd.reject(err);
        } else {
            mqlightClient.on('message', function(eventData) {
                eventDataArray.push(eventData);
            });

            processor.process(msgObj);

            // The timeout serves two purposes:
            // 1/ Avoid waiting forever if no message is received from the processor.
            // 2/ Allow getting all the messages sent by the processor during the timeout interval. Thus, the test
            // can identify situations when the processor sends more messages than expected.
            timeoutObj = setTimeout(function () {
                mqlightClient.stop();
                if (timeoutObj) {
                    clearTimeout(timeoutObj);
                }
                dfd.resolve(eventDataArray);
            }, waitDelay);
        }

    });

    return dfd.promise;
}

describe('Processor test.', function () {

    before(function (done) {
        this.timeout(TEST_TIMEOUT);
        request.post(baseUrl.concat('geofences'))
            .set('accept', 'application/json')
            .type('json')
            .send(newGeofence)
            .end(function (err, res) {
                if (err) {
                    done(err);
                }
                newGeofenceCode = res.body['@code'];
                console.log('Geofence created: ', newGeofenceCode);
                done();
            });
    });

    after(function(done) {
        this.timeout(TEST_TIMEOUT);
        request.delete(baseUrl.concat('geofences/' + newGeofenceCode))
            .set('accept', 'application/json')
            .end(function (err, res) {
                if(err){
                    done(err);
                }
                console.log('Geofence deleted: ', newGeofenceCode);
                expect(res.body).to.be.empty;
                done();
            });
    });

    describe('Processing array of 3 events, including one for unregistered fence.', function () {
        it('Should send 2 MQ messages', function (done) {
            this.timeout(TEST_TIMEOUT);

            newGeofence.properties.id = newGeofenceCode;
            inboundPayload.notifications[0].data.geofenceCode = newGeofenceCode;
            inboundPayload.notifications[2].data.geofenceCode = newGeofenceCode;

            runProcessor(inboundPayload, WAIT_DELAY).then(function(eventDataArray) {
                // console.log('TEST GOT eventDataArray: ' + JSON.stringify(eventDataArray, null, 4));
                expect(eventDataArray).to.deep.equal([
                    {
                        deviceDescriptor: DEVICE_DESCRIPTOR1,
                        detectedTime: DETECTED_TIME1,
                        geofenceCode: newGeofenceCode,
                        geofence: newGeofence,
                        crossingType: CROSSING_TYPE1
                    },
                    {
                        deviceDescriptor: DEVICE_DESCRIPTOR3,
                        detectedTime: DETECTED_TIME3,
                        geofenceCode: newGeofenceCode,
                        geofence: newGeofence,
                        crossingType: CROSSING_TYPE3
                    }
                ]);
                done();
            }).catch(function(err) {
                done(err);
            });
        });
    });
});
