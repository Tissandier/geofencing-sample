/*
 * Copyright TBD
 */

'use strict';

/**
 * The connector endpoint allows the SDK on devices to notify the backend that
 * a given device entered or exited a given geofence.
 * The connector executes payload validation and transfers valid payloads to
 * the event processor.
 */

var express = require('express'),
    _ = require('lodash'),
    basicAuth = require('basic-auth'),
    config = require('../config'),
    processor = require('./processor');

var BASICAUTH_USER = config.username,
    BASICAUTH_PASSWORD = config.password;

var connectorRouter = express.Router({ mergeParams: true });

connectorRouter.use(function (req, res, next) {
    // Authentication
    var user = basicAuth(req);
    if (!user || user.name !== BASICAUTH_USER || user.pass !== BASICAUTH_PASSWORD) {
        console.error('411 unauthorized. Authentication failed');
        res.set('WWW-Authenticate', 'Basic realm=geofencing-sample');
        return res.status(401).send();
    }
    return next();
});


/**
 * Checks that the input argument is a string representing a valid ISO 8601 date-time.
 */
function isValidISO8601DateTime (value) {
    // Valid example: '2016-01-07T04:14:00+00:00'
    var valid = false;
    if (value && _.isString(value)) {
        var date = new Date(value);
        if (_.isDate(date) && !isNaN(date)) {
            var pattern = /^([\+-]?\d{4}(?!\d{2}\b))((-?)((0[1-9]|1[0-2])(\3([12]\d|0[1-9]|3[01]))?|W([0-4]\d|5[0-2])(-?[1-7])?|(00[1-9]|0[1-9]\d|[12]\d{2}|3([0-5]\d|6[1-6])))([T\s]((([01]\d|2[0-3])((:?)[0-5]\d)?|24\:?00)([\.,]\d+(?!:))?)?(\17[0-5]\d([\.,]\d+)?)?([zZ]|([\+-])([01]\d|2[0-3]):?([0-5]\d)?)?)?)?$/;
            valid = pattern.test(value);
        }
    }
    return valid;
}

// Validators for the top-level fields of the payload.
var geofenceValidatorMap = {
    'descriptor': _.isString,
    'detectedTime': isValidISO8601DateTime,
    'data': _.isObject
};

/**
 * Validates the crossing type.
 */
function isValidCrossingType (type) {
    return type === 'enter' || type === 'exit';
}

// Validators for the data field of the payload.
var dataValidatorMap = {
    'geofenceCode': _.isString,
    'crossingType': isValidCrossingType
};

var validatorUtil = {
    validate: function(payload, validatorMap) {
        var isValid = true,
            errMsg,
            contextData,
            errorData = [];

        // Iterate over all fields in order to provide complete error feedback in case more than one field is invalid.
        _.keys(validatorMap).forEach(function(field) {
            var isValidField = false,
                fieldData = payload[field];
            contextData = { // reinit for each validator function
                field: field,
                fieldData: fieldData
            };
            errMsg = undefined; // reinit for each validator function
            var validatorFunction;

            if (fieldData) {
                validatorFunction = validatorMap[field];
                contextData.validator = validatorFunction.name;
                if (_.isFunction(validatorFunction)) {
                    isValidField = validatorFunction(fieldData);
                    if (!isValidField) {
                        errMsg = 'Field (' + field + ') did not validate.';
                    }
                } else {
                    errMsg = 'Validator for field (' + field + ') is not a function.';
                }
            } else {
                errMsg = 'Payload does not have field (' + field + ') defined.';
            }

            if (!isValidField) {
                errorData.push({message: errMsg, contextData: contextData});
                isValid = false; // globally invalid if at least one field is invalid
            }

            return isValidField;
        });

        return {isValid: isValid, errorData: errorData};
    }
};

var geofencePayloadHandler = {
    validate: function(payload) {
        var isPayloadValid = true,
            notificationsArray = payload.notifications,
            errorData = [];

        if (!Array.isArray(notificationsArray)) {
            isPayloadValid = false;
            var errMsg = 'Geofence payload must contain "notifications" array';
            errorData.push({message: errMsg});
        } else {
            // Iterate over all individual events in order to provide complete error feedback in case
            // more than one event is invalid.
            notificationsArray.forEach(function(notification) {
                var valid = validatorUtil.validate(notification, geofenceValidatorMap);
                if (!valid.isValid) {
                    errorData = errorData.concat(valid.errorData);
                    isPayloadValid = false;
                }
                var validData = validatorUtil.validate(notification.data, dataValidatorMap);
                if (!validData.isValid) {
                    errorData = errorData.concat(validData.errorData);
                    isPayloadValid = false;
                }
                return valid.isValid && validData.isValid;
            });
        }
        return {isPayloadValid: isPayloadValid, errorData: errorData};
    },

    transform: function(payload) {
        return payload; // no transformation so far
    }
};

function handleGeofenceNotification(req, res) {
    var geofenceNotificationMessage = req.body;
    var outboundPayload;

    if (!geofenceNotificationMessage) {
        var errMsg = 'No payload provided in request body';
        console.error('No payload given',
            {params: {payload: errMsg}});
        res.status(400).json({error: errMsg});
        return;
    }

    var payloadValidation = geofencePayloadHandler.validate(geofenceNotificationMessage);
    if (payloadValidation.isPayloadValid) {
        outboundPayload = geofencePayloadHandler.transform(geofenceNotificationMessage);
        processor.process(outboundPayload);
        // 202 response on success.
        res.status(202).send();
    } else { // invalid payload
        var errObj = {
            error: 'Invalid payload.',
            details: payloadValidation.errorData,
            payload: req.body
        };
        console.log(JSON.stringify(errObj, null, 4));
        res.status(400).json(errObj);
    }
}

connectorRouter.post('/events', handleGeofenceNotification);

exports = module.exports = connectorRouter;
