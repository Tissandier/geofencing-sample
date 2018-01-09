var expect = require('chai').expect;
var _ = require('lodash');
var request = require('superagent');

var baseUrl = 'http://localhost:9002/';

var urls = {};
urls.geofences = {};

var newGeofence = {
    type: 'Feature',
    geometry: {
        type: 'Point',
        coordinates: [
            2,4
        ]
    },
    properties: {
        name: 'test fence'
    }
};
var newGeofenceNameUpdated = 'new fence name';

var TEST_TIMEOUT = '40s';

describe('Geofence RESTful tests', function() {
    before(function(done){
        urls.geofences = {
            getAll:'geofences',
            createGeofence:'geofences',
            getGeofence:'geofences/{geofenceCode}',
            updateGeofence:'geofences/{geofenceCode}',
            deleteGeofence:'geofences/{geofenceCode}'
        };
        done();
    });

    function sub(url, vars){
        url = url || '';
        vars = vars || {};
        _.each(vars, function(val, key){
            url = url.replace('{' + key + '}', val);
        });
        return url;
    }

    describe('GET all geofences', function(){
        it('should return the list of geofences in this org with a 200', function(done){
            this.timeout(TEST_TIMEOUT);
            request.get(baseUrl.concat(urls.geofences.getAll))
                .set('accept', 'application/json')
                .end(function(err, res){
                    if(err){
                        done(err);
                    }
                    expect(res.body).to.have.any.keys('type', 'features', 'properties');
                    expect(res.body.type).to.equal('FeatureCollection');
                    expect(res.body.features).to.be.an('array');
                    expect(res.body.features).to.have.length.above(-1);
                    done();
                });
        });
    });

    describe('create, update, and delete geofence check', function () {
        var vars = {
            geofenceCode: null
        };
        var updatedGeofenceInfo = null;

        describe('POST a geofence', function () {

            it('should create the geofence and respond with 201 Created', function (done) {
                this.timeout(TEST_TIMEOUT);
                request.post(baseUrl.concat(urls.geofences.createGeofence))
                    .set('accept', 'application/json')
                    .type('json')
                    .send(newGeofence)
                    .end(function (err, res) {
                        if (err) {
                            done(err);
                        }
                        vars.geofenceCode = res.body['@code'];
                        done();
                    });
            });

            it('should fail to create fence with longitude out of range [-180, 180]', function (done) {
                this.timeout(TEST_TIMEOUT);
                var badFence = _.cloneDeep(newGeofence);
                badFence.geometry.coordinates[0] = -181;
                request.post(baseUrl.concat(urls.geofences.createGeofence))
                    .set('accept', 'application/json')
                    .type('json')
                    .send(badFence)
                    .end(function (err, res) {
                        if (err) {
                            expect(res.statusCode).to.equal(400);
                            expect(res.body).to.include('longitude, Number range from 0° to (+/–)180°');
                            done();
                        }
                    });
            });

            it('should fail to create fence with latitude out of range [-90, 90]', function (done) {
                this.timeout(TEST_TIMEOUT);
                var badFence = _.cloneDeep(newGeofence);
                badFence.geometry.coordinates[1] = 91;
                request.post(baseUrl.concat(urls.geofences.createGeofence))
                    .set('accept', 'application/json')
                    .type('json')
                    .send(badFence)
                    .end(function (err, res) {
                        if (err) {
                            expect(res.statusCode).to.equal(400);
                            expect(res.body).to.include('latitude, Number range from 0° to (+/–)90°');
                            done();
                        }
                    });
            });

            it('should fail to create fence with invalid geojson format', function (done) {
                this.timeout(TEST_TIMEOUT);
                var badFence = _.cloneDeep(newGeofence);
                delete badFence.geometry.type;
                request.post(baseUrl.concat(urls.geofences.createGeofence))
                    .set('accept', 'application/json')
                    .type('json')
                    .send(badFence)
                    .end(function (err, res) {
                        if (err) {
                            expect(res.statusCode).to.equal(400);
                            expect(res.body[0].message).to.include('The type property is required and was not found');
                            done();
                        }
                    });
            });
        });

        describe('GET the new geofence', function(){

            it('should load the newly created geofence', function(done) {
                this.timeout(TEST_TIMEOUT);
                request.get(baseUrl.concat(sub(urls.geofences.getGeofence, vars)))
                    .set('accept', 'application/json')
                    .end(function (err, res) {
                        if(err){
                            done(err);
                        }
                        expect(res.body).to.have.any.keys('type', 'geometry', 'properties', '@code', 'coordinates', 'name');
                        expect(res.body.properties.name).to.be.a('string');
                        expect(res.body.properties.description || '').to.be.a('string');
                        expect(res.body.properties.name).to.be.equal('test fence');
                        updatedGeofenceInfo = _.cloneDeep(res.body);
                        updatedGeofenceInfo.properties.name = newGeofenceNameUpdated;
                        done();
                    });
            });
        });

        describe('PUT updated geofence', function(){

            it('should update the newly created geofence and return 200', function(done){
                this.timeout(TEST_TIMEOUT);
                request.put(baseUrl.concat(sub(urls.geofences.updateGeofence, vars)))
                    .type('json')
                    .send(updatedGeofenceInfo)
                    .set('accept', 'application/json')
                    .end(function(err, res){
                        if(err){
                            done(err);
                        }
                        updatedGeofenceInfo = res.body;
                        done();
                    });
            });
        });

        describe('GET the updated geofence', function(){
            it('should load the just updated geofence', function(done) {
                this.timeout(TEST_TIMEOUT);
                request.get(baseUrl.concat(sub(urls.geofences.getGeofence, vars)))
                    .set('accept', 'application/json')
                    .end(function (err, res) {
                        if (err) {
                            done(err);
                        }
                        expect(res.body).to.have.any.keys('type', 'geometry', 'properties', '@code', 'coordinates', 'name');
                        expect(res.body.properties.name).to.be.equal(newGeofenceNameUpdated);
                        expect(res.body.properties['@code']).to.be.deep.equal(updatedGeofenceInfo['@code']);
                        done();
                    });
            });
        });

        describe('DELETE ' + sub(urls.geofences.deleteGeofence, vars), function(){
            it('should delete the geofence and return 200', function(done) {
                this.timeout(TEST_TIMEOUT);
                request.delete(baseUrl.concat(sub(urls.geofences.deleteGeofence, vars)))
                    .set('accept', 'application/json')
                    .end(function (err, res) {
                        if(err){
                            done(err);
                        }
                        expect(res.body).to.be.empty;
                        done();
                    });
            });

            describe('GET ' + sub(urls.geofences.getGeofence, vars), function(){
                it('should fail to load the just deleted fence', function(done) {
                    this.timeout(TEST_TIMEOUT);
                    request.get(baseUrl.concat(sub(urls.geofences.getGeofence, vars)))
                        .set('accept', 'application/json')
                        .end(function (err, res) {
                            if(err){
                                expect(res.statusCode).to.equal(404);
                            }
                            done();
                        });
                });
            });
        });
    });
});