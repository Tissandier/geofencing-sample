/* global define */
'use strict';
define([
    'app',
    'geofence/geofenceService'
], function (app) {

    function GeofenceAutoSave($q, geofenceService) {

        var saveHandlers = {};
        var pendingRequests = 0;

        //---------------------------------------------
        // Constructor of geofence auto save handler
        // This code allows for each fence to have an update request in progress and a pending request.
        //_____________________________________________
        var SaveHandler = function (cloudantId) {

            this.getPayload = function (latLng, radius, name) {
                var payload = {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Point',
                        'coordinates': [latLng.lng, latLng.lat]
                    },
                    'properties': {
                        'name': name,
                        'radius': radius
                    }
                };
                return payload;
            };

            // This method invokes the REST service to persist the fence modification
            // If the request fails, but that this.nextUpdatePayload is not null, we will try to process the next update payload
            // If the request fails, and that this.nextUpdatePayload is null, we will retry until we get the request successful.
            this.performRequest = function (payload) {
                this.currentUpdatePayload = payload;
                pendingRequests++;
                if (JSON.stringify(this.currentUpdatePayload) === JSON.stringify(this.nextUpdatePayload)) {
                    this.nextUpdatePayload = null;
                    pendingRequests--;
                }

                // Uncomment this following code to test when requests fail sometimes
                //if (Math.random() > 0.5) {
                //	payload.properties['@org'] = undefined;
                //} else {
                //	payload.properties['@org'] = state.currentOrg['@code'];
                //}

                var geofences = geofenceService.update({geofence: this.cloudantId}, payload);
                geofences.$promise.then(
                    function () {
                        // The request was succesfull
                        //console.log("Succesfull save request with the following payload: " + JSON.stringify(this.currentUpdatePayload));
                        this.currentUpdatePayload = null;
                        pendingRequests--;
                        if (this.nextUpdatePayload) {
                            this.performRequest(this.nextUpdatePayload);
                        }
                    }.bind(this),
                    function (/*error*/) {
                        // The request failed
                        //console.log("Unsuccesfull save request with the following payload: " + JSON.stringify(this.currentUpdatePayload));
                        //console.log(error);
                        //console.log("Retrying...");
                        this.performRequest(this.currentUpdatePayload);
                        pendingRequests--;
                    }.bind(this)
                );
            };

            this.save = function (latLng, radius, name) {
                var payload = this.getPayload(latLng, radius, name);
                if (this.nextUpdatePayload !== null) {
                    this.nextUpdatePayload = payload;
                } else if (this.currentUpdatePayload !== null) {
                    this.nextUpdatePayload = payload;
                    pendingRequests++;
                } else {
                    this.performRequest(payload);
                }
            };

            //--------------------------------------
            // Initialization
            //--------------------------------------
            // cloudantId of the geofence
            this.cloudantId = cloudantId;
            // payload of the current request in progress
            this.currentUpdatePayload = null;
            // payload of the next request to perform
            this.nextUpdatePayload = null;

        };

        /**
         * Function that returns the save handler for the geofence with the code provided as argument
         */
        this.getSaveHandler = function (code) {
            if (!saveHandlers[code]) {
                saveHandlers[code] = new SaveHandler(code);
            }
            return saveHandlers[code];
        };

        /**
         * This method returns true if there are some pending requests.
         * @param code Optional argument. If code is provided, the return value only applies for a single geofence
         */
            //
        this.hasPendingRequests = function (code) {
            if (!code) {
                return pendingRequests > 0;
            } else {
                var saveHandler = saveHandlers[code];
                return saveHandler && saveHandler.currentUpdatePayload;
            }
        };

        /**
         * This method aborts the pending next request (if any) for the fence with code provided as argument
         * @param code the fence code
         * */
        this.abortNextUpdate = function (code) {
            var saveHandler = saveHandlers[code];
            if (saveHandler) {
                if (saveHandler.nextUpdatePayload !== null) {
                    saveHandler.nextUpdatePayload = null;
                    pendingRequests--;
                }
            }
        };

        this.waitForPendingRequests = function () {
            var dfd = $q.defer();

            var wait = function () {
                if (pendingRequests > 0) {
                    setTimeout(wait, 400);
                } else {
                    dfd.resolve();
                }
            };
            wait();

            return dfd.promise;
        };

        return this;
    };

    app.factory('geofenceAutoSave', ['$q', 'geofenceService', GeofenceAutoSave]);
});
