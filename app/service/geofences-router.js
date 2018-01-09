var express = require('express'),
    Cloudant = require('cloudant'),
    _ = require('lodash'),
    cuid = require('cuid'),
    geojsonhint = require('geojsonhint'),
    config = require('../config');

var db;

// deletes fields we don't want to see until later
var sanitize = function (doc) {
    if (doc.properties) {
        doc.properties['@code'] = doc._id;
    } else if (doc.id) {
        doc['@code'] = doc.id;
        delete doc.id;
    }
    ['_rev', 'rev', '_id'].forEach(function (val) {
        delete doc[val];
    });
    return doc;
};

// GeoJSON format validator - returns an empty array if there is no error
var checkGeoJsonErrors = function (doc) {
    var errors = geojsonhint.hint(doc);
    if (errors.length === 0 && doc.type === 'Feature') {
        if (!_.inRange(doc.geometry.coordinates[1], -90, 90)) {
            errors.push('latitude, Number range from 0° to (+/–)90°');
        }
        if (!_.inRange(doc.geometry.coordinates[0], -180, 180)) {
            errors.push('longitude, Number range from 0° to (+/–)180°');
        }
    }
    return errors;
};

function asyncLoop(o) {
    var i = -1;

    var loop = function(){
        i++;
        if (i >= o.length) { o.callback(); return; }
        o.functionToLoop(loop, i);
    };
    loop(); //init
}

// Return the geofence object with identifier to save on db
var createFeatureObject = function(doc) {
    var geofence = {
        'type': 'Feature',
        'geometry': {
            'type': 'Point',
            'coordinates': [
                0,
                0
            ]
        },
        'properties': {
            'name': '',
            'description': '',
            'radius': 0
        }
    };
    if (doc.properties && doc.properties['@code']) {
        delete doc.properties['@code'];
    }
    _.forEach(doc, function (value, key) {
        _.update(geofence, key, function () {
            return value;
        });
    });
    geofence._id = cuid();
    geofence.properties.name = (doc.properties.name !== undefined) ? doc.properties.name : geofence._id;
    geofence.properties.radius = (doc.properties.radius !== undefined) ? doc.properties.radius : 100;

    return geofence;
};

// GEOFENCING API ROUTES
// =============================================================================
var router = express.Router();

//middleware for all requests  (intercept all calls to the service to intialize the database ...)
router.use(function (req, res, next) {
    //database initialization
    if (!db) {

        var dbCredentials;

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

    }
    next();
});

// on routes that end in /geofences
router.route('/geofences')
    // GET geofences listing.
    .get(function (req, res) {
        db.find({
            selector: {
                '_id': {
                    '$gt': null
                }
            }
        }, function (err, data) {
            if (err) {
                res.status(err.status || err.statusCode || 500).send(err);
            }
            res.setHeader('Content-disposition', 'attachement; filename=geofences.geojson');
            res.writeHead(200, {'Content-Type': 'application/vnd.geo+json'});

            res.write('{\"type\":\"FeatureCollection\",');
            res.write('\"features\":[');
            data.docs.forEach(function (result, index) {
                res.write(JSON.stringify(sanitize(result)));
                if (index !== data.docs.length - 1) {
                    res.write(',');
                }
            });
            res.write('],');
            res.write('\"properties\":' + JSON.stringify({'totalFeatures': data.docs.length}));
            res.end('}');
        });
    })
    // Create a geofence
    .post(function (req, res) {
        //  Validates payload
        var errors = checkGeoJsonErrors(req.body);
        if (errors.length > 0) {
            res.status(400).send(errors);
        } else {
            if (req.body.type === 'Feature') {
                db.insert(createFeatureObject(req.body), function (err, data) {
                    if (err) {
                        res.status(err.status || err.statusCode || 500).send(err);
                    }
                    res.status(201).json(sanitize(data));
                });
            } else {
                var numLoops = req.body.features.length,
                    geofences = [];
                asyncLoop({
                    length: numLoops,
                    functionToLoop: function (loop, i) {
                        geofences.push(createFeatureObject(req.body.features[i]));
                        loop();
                    },
                    callback: function () {
                        db.bulk({docs: geofences}, function (err, data) {
                            if (err) {
                                res.status(err.status || err.statusCode || 500).send(err);
                            }
                            res.status(201).json({'docs': data.length});
                        });
                    }
                });
            }
        }
    });
// on routes that end in /geofences/:id
router.route('/geofences/:id')
    //Update a geofence
    .put(function (req, res) {
        var errors = checkGeoJsonErrors(req.body);
        if (errors.length > 0) {
            res.status(400).send(errors);
        } else {
            // get the geofence with that unique identifier :id
            db.get(req.params.id, {revs_info: true}, function (err1, doc) {
                if (!err1) {
                    //Updating geofence Info
                    if (req.body.properties && req.body.properties['@code']) {
                        delete req.body.properties['@code'];
                    }
                    _.forEach(req.body, function (value, key) {
                        _.update(doc, key, function () {
                            return value;
                        });
                    });
                    //commit updates
                    db.insert(doc, function (err2, data) {
                        if (err2) {
                            res.status(err2.status || err2.statusCode || 500).send(err2);
                        }
                        res.json(sanitize(data));
                    });
                } else {
                    res.status(err1.status || err1.statusCode || 500).send(err1);
                }
            });
        }
    })
    // Retrieve a geofence with that unique identifier :id
    .get(function (req, res) {
        db.get(req.params.id, function (err, data) {
            if (err) {
                res.status(err.status || err.statusCode || 500).send(err);
            } else {
                res.json(sanitize(data));
            }
        });
    })
    //deleting a geofence
    .delete(function (req, res) {
        // get the geofence with that  unique identifier :id
        db.get(req.params.id, {revs_info: true}, function (err1, doc) {
            if (!err1) {
                // // delete the geofence with the code specified
                db.destroy(req.params.id, doc._rev, function (err2, data) {
                    if (err2) {
                        res.status(err2.status || err2.statusCode || 500).send(err2);
                    } else {
                        res.json({});
                    }
                });
            } else {
                res.status(err1.status || 500).send(err1);
            }
        });
    });

module.exports = router;
