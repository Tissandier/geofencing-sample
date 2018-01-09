/* global define */
'use strict';
define([
    'app',
    'geofence/geofenceMap',
    'geofence/geofenceFactory',
    'geofence/geofenceService'
], function (app) {

    /* global L */


    /**
     * The GeofenceDataProxy class maintains the list of fences displayed in the map.
     *
     * The 'fences' attribute is the list of fences displayed
     * In this list, each fence is uniquely identified using an internal GUID, which is different to the cloudant Id
     * that is only available when fences are already stored in Cloudant.
     * In this list, a newly created fence which is not yet persisted in the Cloudant database will have an internal ID,
     * but no cloudant Id.
     * The 'fences' attribute is a hashmap where for each entry:
     * - the key is the internal ID of the fence,
     * - the value is the fence itself.
     *
     * The GeofenceDataProxy also allows you to import fences from a GeoJSON content.
     *
     * @param $q for promises handling
     * @param $timeout to ensure that data bindings are properly updated
     * @param geofenceFactory The geofence factory is used to create fences.
     * @param geofenceService The geofence service is used to persist creation, deletion and impot of fences
     * @returns {GeofenceDataProxy}
     * @constructor
     */
    function GeofenceDataProxyFactory($q, $timeout, geofenceMap, geofenceFactory, geofenceService) {

        /**
         * Data proxy contructor method
         * @param scope to use for this data proxy
         * */
        this.GeofenceDataProxy = function (scope) {
            //console.log('Initializing GeofenceDataProxy for ' + scope['@code']);

            /**
             * Add a fence
             * @param latLng
             * @param radius
             * @param name
             * @param cloudantId
             * @returns {GeofenceFactory.Geofence}
             */
            this.addFence = function (latLng, radius, name, cloudantId) {
                var geofence = new geofenceFactory.Geofence(
                    this.currentScope,
                    latLng,
                    (radius < this.currentScope.minRadius) ? this.currentScope.minRadius : ((radius > this.currentScope.maxRadius) ? this.currentScope.maxRadius : parseInt(radius.toFixed())),
                    name ? name : 'Unnamed geofence',
                    cloudantId);

                //console.log('Adding fence with id: ' + geofence.internalId);
                this.fences[geofence.internalId] = geofence;

                return geofence;
            };

            /**
             * Adds a list of fences to the dataProxy
             * @param geofences
             * */
            this.addFences = function (geofences) {
                geofences.forEach(function (geofence) {
                    var g = this.addFence(L.latLng(
                        geofence.geometry.coordinates[1],
                        geofence.geometry.coordinates[0]),
                        geofence.properties.radius,
                        geofence.properties.name,
                        geofence.properties['@code']);
                    if (this.selectedFence && (this.selectedFence.cloudantId === geofence.properties['@code'])) {
                        this.selectFence(g.internalId);
                    }
                }.bind(this));
            };

            /**
             * Delete a fence
             * @param id internal ID of the fence
             */
            this.removeFence = function (id) {
                //console.log('Removing fence with id: ' + id);
                var dfd = $q.defer();
                var fence = this.fences[id];
                if (fence.cloudantId) {
                    geofenceService.delete({geofence: fence.cloudantId}).$promise.then(function () {
                        dfd.resolve();
                    });
                    this.currentScope.onFenceRemove(fence.cloudantId);
                }
                this.geofenceMap.removeGeofence(fence.geofenceCircle);
                fence.geofenceCircle = null;
                delete this.fences[id];
                return dfd.promise;
            };

            /**
             * Utility method that returns a fence from the proxy using its internal ID (not the ['@code'] property
             * @param id
             * @returns {*}
             */
            this.getFence = function (id) {
                return this.fences[id];
            };

            /**
             * Utility method that returns a fence from the proxy using its cloudant ['@code'] property
             * @param cloudantId
             * @returns {*}
             */
            this.getFenceByCloudantId = function (cloudantId) {
                for (var i in this.fences) {
                    if (this.fences[i].cloudantId === cloudantId) {
                        return this.fences[i];
                    }
                }
            };

            /**
             * Select a fence
             * @param id internal ID of the fence (not the ['@code'] property
             */
            this.selectFence = function (id) {
                var fenceSelectionChange = !this.selectedFence || this.selectedFence.internalId !== id
                if (this.selectedFence && (this.selectedFence.internalId !== id)) {
                    this.unSelect();
                }
                this.selectedFence = this.fences[id];
                if (this.selectedFence) {
                    this.selectedFence.select();
                    if (fenceSelectionChange) {
                        this.currentScope.onFenceSelect(this.selectedFence.cloudantId);
                    }
                }
                this.selectedFence.attributes.latLng.lat = parseFloat(this.selectedFence.geofenceCircle.circle._latlng.lat);
                this.selectedFence.attributes.latLng.lng = parseFloat(this.selectedFence.geofenceCircle.circle._latlng.lng);
            };

            /**
             * Unselect the current fence
             */
            this.unSelect = function () {
                if (this.selectedFence) {
                    this.selectedFence.unSelect();
                }
                this.selectedFence = undefined;
            };

            /**
             * load fences from GeoJSON content
             * @param geoJSON the geoJSON content
             * @param defaultRadius the default radius to use if the geoJSON feature does not have one defined
             * @param defaultGeofenceName the default name to use if the geoJSON feature does not have one defined
             * @returns {*} a promise ehich is resolved when the import is done
             */
            this.loadGeoJSON = function (geoJSON, defaultRadius, defaultGeofenceName) {
                var dfd = $q.defer();


                this.currentScope.geofenceMap.setEditMode(this.currentScope.geofenceMap.UPLOAD_MODE);

                this.lastUploadPayload = {
                    'type': 'FeatureCollection',
                    'features': []
                };

                var features = geoJSON.features;
                var i = 0;
                features.forEach(function (feature) {
                    if (feature.geometry && (feature.geometry.type === 'Point')) {

                        // Radius
                        var radius = defaultRadius;
                        if (feature.properties && feature.properties.radius) {
                            if (!isNaN(feature.properties.radius)) {
                                if (feature.properties.radius < this.currentScope.dataProxy.minRadius) {
                                    radius = this.currentScope.dataProxy.minRadius;
                                } else if (feature.properties.radius > this.currentScope.dataProxy.maxRadius) {
                                    radius = this.currentScope.dataProxy.maxRadius;
                                } else {
                                    radius = parseInt(feature.properties.radius.toFixed());
                                }
                            }
                        }

                        // Name
                        var name = undefined;
                        if (feature.properties && feature.properties.name) {
                            name = feature.properties.name;
                        }
                        if (!(name && name.trim())) {
                            if ((feature.properties && feature.properties.tags && feature.properties.tags.name)) {
                                name = feature.properties.tags.name;
                            }
                        }
                        if (!(name && name.trim())) {
                            name = defaultGeofenceName + (++i);
                        }

                        // Add geofences
                        var geofence = this.addFence(L.latLng(feature.geometry.coordinates[1], feature.geometry.coordinates[0]),
                            radius,
                            name);
                        this.lastUploadPayload.features.push(geofence.toGeoJSON());

                    }
                }.bind(this));
                if (this.lastUploadPayload.features.length > 0) {
                    this.currentScope.geofenceMap.fitToContent();
                } else {
                    this.currentScope.geofenceMap.setEditMode(this.currentScope.geofenceMap.EDIT_MODE);
                }
                dfd.resolve();
                return dfd.promise;

            };

            /**
             * This method persists the previously imported fences
             * and reloads the entire fences from the server
             * @returns {*|Function} a promise resolved when the transaction with the server is over and the re-init is done
             */
            this.saveUpload = function () {
                var promise = geofenceService.create(this.lastUploadPayload).$promise;
                promise.then(
                    // success
                    function (result) {
                        var nFencesImported =this.lastUploadPayload.features.length;
                        if (nFencesImported === 1) {
                            this.currentScope.infoMessage = 'The geofence was successfully imported';
                        } else {
                            this.currentScope.infoMessage = nFencesImported + ' geofences were successfully imported';
                        }
                        this.currentScope.init();
                    }.bind(this),
                    function (/*error*/) {
                        this.currentScope.errorMessage = 'The geofence import failed';
                        this.currentScope.init();
                    }
                );
                return promise;
            };

            /**
             * This method cancels the current upload by reloading the entire geofences from the server
             */
            this.cancelUpload = function () {
                this.currentScope.infoMessage = undefined;
                this.currentScope.init();
            };

            /**
             * Persist a single fence
             * @param fence
             * @returns {*|Function} a promise
             */
            this.persistFence = function (fence) {
                var fenceGeoJSON = fence.toGeoJSON();
                var promise = geofenceService.create(fenceGeoJSON).$promise;
                promise.then(
                    // success
                    function (result) {
                        // We add the created geofence to the scope list
                        fenceGeoJSON.properties['@code'] = result['@code'];
                        fence.cloudantId = result['@code'];
                        this.currentScope.geofenceList = [fenceGeoJSON].concat(
                            this.currentScope.geofenceList ?
                                this.currentScope.geofenceList :
                                []);
                        $timeout(function () {
                            this.selectFence(fence.internalId);
                        }.bind(this));
                    }.bind(this),
                    //failure
                    function (/*error*/) {
                        this.currentScope.errorMessage = 'The fence creation failed';
                        this.removeFence(fence.internalId);
                    }
                );
                return promise;
            };

            /**
             * When creating a fence on leaflet, the longitude may be greater than +180 or lower than -180
             * @param latLng
             */
            this.sanitizeLatLng = function (latLng) {
                var lng = latLng.lng;
                while (Math.abs(lng) > 180) {
                    if (lng <= -180) {
                        lng = lng + 360;
                    } else if (lng >= 180) {
                        lng = lng - 360;
                    }
                }
                return L.latLng(latLng.lat, lng);
            };

            //-------------------------------------
            // INITIALIZATION
            //-------------------------------------

            this.currentScope = scope;
            this.currentScope.dataProxy = this;

            this.selectedFence = undefined;

            this.fences = {};

            this.currentScope.minRadius = 100;
            this.currentScope.maxRadius = 10000;
            this.currentScope.FENCE_COLOR = '#58607a'; //$bm-dark-purple
            this.currentScope.SELECTED_FENCE_COLOR = '#DB2780'; //$magenta50

            this.fences = []; //list of fences displayed on the map

            this.geofenceMap = this.currentScope.geofenceMap;

            if (this.geofenceMap) {
                this.geofenceMap.initLayers();
            } else if (!this.currentScope.geofenceMap && this.currentScope.leafletMap) {
                this.currentScope.geofenceMap = new geofenceMap.GeofenceMap(this.currentScope);
                this.geofenceMap = this.currentScope.geofenceMap;
            }

            this.addFences(this.currentScope.geofenceList);


            this.currentScope.geofenceMap.setEditMode(this.currentScope.geofenceMap.EDIT_MODE);
            this.currentScope.geofenceMap.fitToContent(true);
        };

        return this;
    };

    app.factory('geofenceDataProxy', ['$q', '$timeout', 'geofenceMap', 'geofenceFactory', 'geofenceService', GeofenceDataProxyFactory]);
});
