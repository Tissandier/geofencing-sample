var express = require('express'),
    bodyParser = require('body-parser'),
    config = require('./config.json'),
    cloudant = require('cloudant'),
    connectorRouter = require('./service/connector-router'),
    geofencesRouter = require('./service/geofences-router');

var port = (process.env.VCAP_APP_PORT || 9002);

// config environment
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
    dbCredentials = {
        dbName: 'geofences',
        user: config.cloudantUsername,
        password: config.cloudantPassword
    };
}

if (!dbCredentials.user || !dbCredentials.password) {
    throw new Error('Cloudant credentials missing.');
}

// init db
cloudant({account: dbCredentials.user, password: dbCredentials.password}, function (err1, cloud) {
    if (err1) {
        console.log('cannot log to cloudant');
    } else {
        cloud.db.get(dbCredentials.dbName, function (err2) {
            if (err2) {
                console.log('db does not exists - creating it');
                // trying to create and initialize it
                cloud.db.create(dbCredentials.dbName, function (err3) {
                    if (err3) {
                        console.log('cannot create db', err3);
                    } else {
                        console.log('database created');
                        cloud.use(dbCredentials.dbName);
                    }
                });
            } else {
                cloud.use(dbCredentials.dbName);
            }
        });
    }
});

// Setup routes

var app = express();
app.use(bodyParser.json({limit: '15mb', strict: false}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('ui'));

app.use('/', geofencesRouter);
app.use('/', connectorRouter);

app.listen(port, function () {
    console.log('Server is listening to port ' + port);
});


