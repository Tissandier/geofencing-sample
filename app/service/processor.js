/*
 * Copyright TBD
 */

'use strict';

var Cloudant    = require('cloudant'),
    Promise     = require('bluebird'),
    _           = require('lodash'),
    mqlight     = require('mqlight'),
    config      = require('../config');

//database initialization
var cloudant,db,dbCredentials;

if (process.env.VCAP_SERVICES) {
    var vcapServices = JSON.parse(process.env.VCAP_SERVICES);
    if (vcapServices.cloudantNoSQLDB) {
        dbCredentials = {
            dbName: 'geofences',
            user: vcapServices.cloudantNoSQLDB[0].credentials.username,
            password: vcapServices.cloudantNoSQLDB[0].credentials.password
        };
    }
} else {
    console.log('Running outside of Bluemix, using Cloudant instance specified in config.json file');
    dbCredentials = {
        dbName: 'geofences',
        user: config.cloudantUsername,
        password: config.cloudantPassword
    };
}
var cloudant = Cloudant({account: dbCredentials.user, password: dbCredentials.password});
db = cloudant.use(dbCredentials.dbName);


// init MQLight

var mqCredentials = config.mqlight.credentials;

if (process.env.VCAP_SERVICES) {
    var services = JSON.parse(process.env.VCAP_SERVICES);
    if (services.mqlight) {
        mqCredentials.username = services.mqlight[0].credentials.username;
        mqCredentials.password = services.mqlight[0].credentials.password;
        mqCredentials.connectionLookupURI = services.mqlight[0].credentials.connectionLookupURI;

    } else {
        throw new Error('Running in IBM Bluemix but not bound to an instance ' +
        "of the 'mqlight' service.");
    }

} else  {

    console.log('Running outside of Bluemix, using MQ instance specified in config.json file');

}
console.log('MQ Username:  ' + mqCredentials.username);
console.log('MQ Password:  ' + mqCredentials.password);
console.log('MQ LookupURI: ' + mqCredentials.connectionLookupURI);

var mqlightClient = mqlight.createClient({
    service  : mqCredentials.connectionLookupURI,
    user     : mqCredentials.username,
    password : mqCredentials.password
});

// deletes fields we dont want to see until later
var sanitize = function (doc) {
    if(doc.properties){
        doc.properties.id = doc._id;
    }
    _.each(['_rev', 'rev',  '_id'], function (val) {
        _.unset(doc, val);
    });
    return doc;
};

/**
 * Retrieves in the Cloudant db the information stored for the given geofence code.
 */
function getGeofenceInfo(geofenceCode) {
    var dfd = Promise.defer();

    // get geofence details from cloudant
    db.get(geofenceCode, function (err, data) {
        if (err) {
            console.log('\n>> No geofence in DB found with code:', geofenceCode);
            dfd.reject(err);
        } else {
            var geofence = sanitize(data);
            console.log('\n>> Got geofence from DB:');
            console.log(JSON.stringify(geofence, null, 4));

            dfd.resolve(geofence);
        }
    });

    return dfd.promise;
}

/**
 * Creates a hash object with the key-value pairs as follows:
 * key: geofence code
 * value: object with detailed information about the geofence.
 * The purpose here is to ensure that, if the event array contains several events for the
 * same fence, the info is read from cloudant only once per geofence.
 */
function buildGeofencesMap(events) {
    var dfd = Promise.defer();
    var geofenceCode, geofencesMap = {}, unknownGeofenceCodes = {};

    Promise.each(events.notifications, function (event) {
        geofenceCode = event.data.geofenceCode;
        if (!geofencesMap[geofenceCode] && !unknownGeofenceCodes[geofenceCode]) {
            return getGeofenceInfo(geofenceCode).then(function (geofence) {
                geofencesMap[geofenceCode] = geofence;
            }).catch(function () {
                unknownGeofenceCodes[geofenceCode] = true;
            });
        }
    }).then(function() {
        return dfd.resolve(geofencesMap);
    });

    return dfd.promise;
}

function processOneEvent(event, geofencesMap) {
    var geofenceCode = event.data.geofenceCode;
    var geofence = geofencesMap[geofenceCode];
    if (geofence) {
        // create output payload and add it in the collection
        var outboundPayload = {
            deviceDescriptor: event.descriptor,
            detectedTime: event.detectedTime,
            geofenceCode: geofenceCode,
            geofence: geofence,
            crossingType: event.data.crossingType
        };
        console.log('\n>>Processor sends MQLight message:');
        console.log(JSON.stringify(outboundPayload, null, 4));
        mqlightClient.send('geofencingSample/event', outboundPayload);
    }
    // silently ignore events for geofence codes not stored in cloudant
}

var processor = {
    process: function (events) {
        console.log('\n>> Processor received geofence notification:');
        console.log(JSON.stringify(events, null, 4));

        buildGeofencesMap(events).then(function(geofencesMap) {
            // Iterate over the individual events contained in the message.
            // Note that Promise.each waits for the resolution of the promise returned by processOneEvent()
            // before iterating to the next event. This is necessary to ensure the correct order for
            // the event processing.
            events.notifications.forEach(function (event) {
                processOneEvent(event, geofencesMap);
            });
        });
    }
};

exports = module.exports = processor;
