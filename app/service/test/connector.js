/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
/* eslint camelcase: 0 */
'use strict';

// dependencies
// -----------------------------------------------------------------------------
var request = require('supertest');
var expect = require('chai').expect;
var config = require('../../config');

// constants
// -----------------------------------------------------------------------------
var TEST_TIMEOUT = '40s';

// testing variables
// -----------------------------------------------------------------------------
var notification = '/events', postData, username = config.username, password = config.password;

// set host for the tests
request = request(process.env.APP_ROUTE || 'localhost:9002');

/**
 * Assert the presence of the expected error feedback for invalid fields in the payload.
 * @param {object} res The response received from the connectorRouter.
 * @param {array} invalidFields The array of objects containing the name of invalid fields in the payload,
 * and optionally containing a boolean 'missing' field allowing to assert the correct error feedback for
 * missing fields.
 */
function checkErrorFeedback(res, invalidFields) {
    var errorFeedback = res.body;
    expect(errorFeedback).to.be.an.Object;
    expect(errorFeedback).to.have.property('details');
    var details = errorFeedback.details;
    expect(details).to.be.an.Array;
    var n = invalidFields.length;
    expect(details).to.have.length(n, 'Unexpected number of invalid fields in response body');
    for (var i = 0; i < n; i++) {
        var fieldInfo = invalidFields[i];
        var fieldName = fieldInfo.field;
        var detail = details[i];
        expect(detail).to.have.property('message');
        expect(detail).to.have.property('contextData');
        var contextData = detail.contextData;
        expect(contextData).to.have.property('field');
        expect(contextData.field).to.be.equal(fieldName);
        if (fieldInfo.missing) {
            expect(contextData).to.not.have.property('fieldData');
            expect(contextData).to.not.have.property('validator');
        } else {
            expect(contextData).to.have.property('fieldData');
            expect(contextData).to.have.property('validator');
        }
    }
}

describe('Geofence Connector Tests', function () {
    describe('Geofence Connector Data Endpoint Sniff Tests', function () {
        describe('POST valid JSON payload', function () {
            it('should validate json and respond with 202 (crossingType: enter)', function (done) {
                this.timeout(TEST_TIMEOUT);
                postData = {
                    'notifications': [{
                        'descriptor': '072bad9d-8b76-43b1-b2f4-7b28b1e8a9dd',
                        'detectedTime': '2015-05-04T18:39:33.719Z',
                        'data': {
                            'geofenceCode': 'B9407F30-F5F8-466E-AFF9-25556B57FE6D',
                            'crossingType': 'enter'
                        }
                    }]
                };
                request
                    .post(notification)
                    .send(postData)
                    .set('Content-Type', 'application/json')
                    .auth(username, password, true)
                    .expect(202)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        } else {
                            done();
                        }
                    });
            });

            it('should validate json and respond with 202 (crossingType: exit)', function (done) {
                this.timeout(TEST_TIMEOUT);
                postData = {
                    'notifications': [{
                        'descriptor': '072bad9d-8b76-43b1-b2f4-7b28b1e8a9dd',
                        'detectedTime': '2015-05-04T18:39:33.719Z',
                        'data': {
                            'geofenceCode': 'B9407F30-F5F8-466E-AFF9-25556B57FE6D',
                            'crossingType': 'exit'
                        }
                    }]
                };

                request
                    .post(notification)
                    .send(postData)
                    .set('Content-Type', 'application/json')
                    .auth(username, password, true)
                    .expect(202)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        } else {
                            done();
                        }
                    });
            });

            it('should validate json and respond with 202 (non-UUID device descriptor)', function (done) {
                this.timeout(TEST_TIMEOUT);
                postData = {
                    'notifications': [{
                        'descriptor': 'some non-UUID descriptor',
                        'detectedTime': '2015-05-04T18:39:33.719Z',
                        'data': {
                            'geofenceCode': 'B9407F30-F5F8-466E-AFF9-25556B57FE6D',
                            'crossingType': 'exit'
                        }
                    }]
                };

                request
                    .post(notification)
                    .send(postData)
                    .set('Content-Type', 'application/json')
                    .auth(username, password, true)
                    .expect(202)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        } else {
                            done();
                        }
                    });
            });

            it('should validate json and respond with 202 (payload with several events)', function (done) {
                this.timeout(TEST_TIMEOUT);
                postData = {
                    'notifications': [
                        {
                            'descriptor': '072bad9d-8b76-43b1-b2f4-7b28b1e8a9dd',
                            'detectedTime': '2015-05-04T18:39:33.719Z',
                            'data': {
                                'geofenceCode': 'B9407F30-F5F8-466E-AFF9-25556B57FE6D',
                                'crossingType': 'enter'
                            }
                        },
                        {
                            'descriptor': '7eac304d-296e-4a02-90d7-028a34abdd3c',
                            'detectedTime': '2015-06-04T18:39:33.719Z',
                            'data': {
                                'geofenceCode': 'B9407F30-F5F8-466E-AFF9-25556B57FE6D',
                                'crossingType': 'enter'
                            }
                        }]
                };

                request
                    .post(notification)
                    .send(postData)
                    .set('Content-Type', 'application/json')
                    .auth(username, password, true)
                    .expect(202)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        } else {
                            done();
                        }
                    });
            });

            describe('POST invalid JSON payload', function () {
                // Check that payload with invalid detectedTime is rejected
                it('should invalidate json and respond with 400 for invalid detectedTime (dummy string)', function (done) {
                    this.timeout(TEST_TIMEOUT);
                    postData = {
                        'notifications': [{
                            'descriptor': '072bad9d-8b76-43b1-b2f4-7b28b1e8a9dd',
                            'detectedTime': 'some invalid string',
                            'data': {
                                'geofenceCode': 'B9407F30-F5F8-466E-AFF9-25556B57FE6D',
                                'crossingType': 'enter'
                            }
                        }]
                    };

                    request
                        .post(notification)
                        .send(postData)
                        .set('Content-Type', 'application/json')
                        .auth(username, password, true)
                        .expect(400)
                        .end(function (err, res) {
                            if (err) {
                                return done(err);
                            } else {
                                checkErrorFeedback(res, [{field: 'detectedTime'}]);
                                done();
                            }
                        });
                });

                // Check that payload with invalid detectedTime is rejected
                it('should invalidate json and respond with 400 for invalid detectedTime ' +
                    '(timestamp instead of ISO 8601)', function (done) {
                    this.timeout(TEST_TIMEOUT);
                    postData = {
                        'notifications': [{
                            'descriptor': '072bad9d-8b76-43b1-b2f4-7b28b1e8a9dd',
                            'detectedTime': 1455874891948,
                            'data': {
                                'geofenceCode': 'B9407F30-F5F8-466E-AFF9-25556B57FE6D',
                                'crossingType': 'enter'
                            }
                        }]
                    };

                    request
                        .post(notification)
                        .send(postData)
                        .set('Content-Type', 'application/json')
                        .auth(username, password, true)
                        .expect(400)
                        .end(function (err, res) {
                            if (err) {
                                return done(err);
                            } else {
                                checkErrorFeedback(res, [{field: 'detectedTime'}]);
                                done();
                            }
                        });
                });

                // Check that payload with invalid crossingType is rejected
                it('should invalidate json and respond with 400 for invalid crossingType', function (done) {
                    this.timeout(TEST_TIMEOUT);
                    postData = {
                        'notifications': [{
                            'descriptor': '072bad9d-8b76-43b1-b2f4-7b28b1e8a9dd',
                            'detectedTime': '2015-05-04T18:39:33.719Z',
                            'data': {
                                'geofenceCode': 'B9407F30-F5F8-466E-AFF9-25556B57FE6D',
                                'crossingType': 'some unsupported type'
                            }
                        }]
                    };

                    request
                        .post(notification)
                        .send(postData)
                        .set('Content-Type', 'application/json')
                        .auth(username, password, true)
                        .expect(400)
                        .end(function (err, res) {
                            if (err) {
                                return done(err);
                            } else {
                                checkErrorFeedback(res, [{field: 'crossingType'}]);
                                done();
                            }
                        });
                });

                it('should invalidate json and respond with 400 for missing geofenceCode field', function (done) {
                    this.timeout(TEST_TIMEOUT);
                    postData = {
                        'notifications': [{
                            'descriptor': '072bad9d-8b76-43b1-b2f4-7b28b1e8a9dd',
                            'detectedTime': '2015-05-04T18:39:33.719Z',
                            'data': { // missing geofenceCode field
                                'crossingType': 'enter'
                            }
                        }]
                    };

                    request
                        .post(notification)
                        .send(postData)
                        .set('Content-Type', 'application/json')
                        .auth(username, password, true)
                        .expect(400)
                        .end(function (err, res) {
                            if (err) {
                                return done(err);
                            } else {
                                checkErrorFeedback(res, [{
                                    field: 'geofenceCode',
                                    missing: true
                                }]);
                                done();
                            }
                        });
                });

                it('should invalidate json and respond with 400 for missing crossingType field', function (done) {
                    this.timeout(TEST_TIMEOUT);
                    postData = {
                        'notifications': [{
                            'descriptor': '072bad9d-8b76-43b1-b2f4-7b28b1e8a9dd',
                            'detectedTime': '2015-05-04T18:39:33.719Z',
                            'data': { // missing crossingType field
                                'geofenceCode': 'B9407F30-F5F8-466E-AFF9-25556B57FE6D'
                            }
                        }]
                    };

                    request
                        .post(notification)
                        .send(postData)
                        .set('Content-Type', 'application/json')
                        .auth(username, password, true)
                        .expect(400)
                        .end(function (err, res) {
                            if (err) {
                                return done(err);
                            } else {
                                checkErrorFeedback(res, [{
                                    field: 'crossingType',
                                    missing: true
                                }]);
                                done();
                            }
                        });
                });

                it('should invalidate json and respond with 400 with correct error feedback for multiple invalid fields',
                    function (done) {
                        this.timeout(TEST_TIMEOUT);
                        postData = {
                            'notifications': [{
                                'descriptor': '072bad9d-8b76-43b1-b2f4-7b28b1e8a9dd',
                                'detectedTime': 'some invalid time',
                                'data': { // missing crossingType field
                                    'geofenceCode': 'B9407F30-F5F8-466E-AFF9-25556B57FE6D'
                                }
                            }]
                        };

                        request
                            .post(notification)
                            .send(postData)
                            .set('Content-Type', 'application/json')
                            .auth(username, password, true)
                            .expect(400)
                            .end(function (err, res) {
                                if (err) {
                                    return done(err);
                                } else {
                                    checkErrorFeedback(res,
                                        [{
                                            field: 'detectedTime',
                                            missing: false
                                        }, {
                                            field: 'crossingType',
                                            missing: true
                                        }]);
                                    done();
                                }
                            });
                    });
            });
        });
    });
});
