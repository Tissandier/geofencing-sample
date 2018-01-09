/* global define */
'use strict';
define([
    'app',
    'angular',
    'geofence/geofenceCircle',
    'geofence/geofenceAutoSave'
], function (app, angular) {

    /* global L */

    function GeofenceFactory(geofenceCircleFactory, $timeout, geofenceAutoSave) {

        /**
         * Utility method to return a GUID
         * @returns {string}
         */
        function guid() {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        };

        /**
         * Attribute class holding values for latLng, radius, name, description and tags
         * @param latLng
         * @param radius
         * @param name
         * @constructor
         */
        var GeofenceAttributes = function (latLng, radius, name) {
            this.latLng = latLng;
            this.radius = radius;
            this.name = name;
        };

        /**
         * Geofence constructor
         * @param scope
         * @param latLng
         * @param radius
         * @param name [optional]
         * @param cloudantId [optional]
         * @constructor
         */
        this.Geofence = function (scope, latLng, radius, name, cloudantId) {

            /**
             * Each time an attribute is changed, we get there to decide wether the change should be persisted or not.
             */
            this.notifyUpdate = function () {
                if ((this.attributes.name && this.attributes.name.trim().length > 0)
                    && (!isNaN(parseFloat(this.attributes.latLng.lat)))
                    && (!isNaN(parseFloat(this.attributes.latLng.lng)))
                    && (!isNaN(parseFloat(this.attributes.radius)))
                    && this.cloudantId) {
                    this.currentScope.onFenceUpdate(this.cloudantId, this.attributes.latLng, this.attributes.radius, this.attributes.name);
                }
            };

            /**
             * Function to refresh the geofence displayed on the map.
             */
            this.refresh = function () {
                this.currentScope.updateFenceName(this.cloudantId, this.attributes.name);
                this.notifyUpdate();
                this.move(this.attributes.latLng);
                this.setRadius(this.attributes.radius);
            }.bind(this);

            /**
             * Move the fence
             * @param newLatLng
             */
            this.move = function (newLatLng) {
                if ((!isNaN(parseFloat(this.attributes.latLng.lat)))
                    && (!isNaN(parseFloat(this.attributes.latLng.lng)))){
                    $timeout(function () {
                        var sanitizedLatLng = this.currentScope.dataProxy.sanitizeLatLng(newLatLng);
                        this.attributes.latLng.lat = sanitizedLatLng.lat;
                        this.attributes.latLng.lng = sanitizedLatLng.lng;
                        this.notifyUpdate();
                        this.geofenceCircle.move(this.attributes.latLng);
                        this.currentScope.geofenceMap.fitToGeofenceCircle(this.geofenceCircle);
                    }.bind(this));
                }
            };

            /**
             * Resize the fence
             * @param newRadius
             */
            this.setRadius = function (newRadius) {
                if (!isNaN(parseFloat(newRadius))) {
                    $timeout(function () {
                        this.attributes.radius = (newRadius < this.currentScope.minRadius) ? this.currentScope.minRadius : ((newRadius > this.currentScope.maxRadius) ? this.currentScope.maxRadius : parseInt(newRadius.toFixed()));
                        this.notifyUpdate();
                        this.geofenceCircle.setRadius(this.attributes.radius);
                    }.bind(this));
                }
            };

            /**
             * Select the geofence
             */
            this.select = function () {
                this.geofenceCircle.select();
            };

            /**
             * UnSelect the geofence
             */
            this.unSelect = function () {
                if (this.geofenceCircle) {
                    this.geofenceCircle.unSelect();
                }
            };

            /**
             * outputs a geoJSON object representing the current fence
             * @returns {{type: string, geometry: {type: string, coordinates: *[]}, properties: {name: *, radius: *}}}
             */
            this.toGeoJSON = function () {
                var geoJson = {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Point',
                        'coordinates': [this.attributes.latLng.lng, this.attributes.latLng.lat]
                    },
                    'properties': {
                        'name': this.attributes.name,
                        'radius': this.attributes.radius,
                    }
                };
                if (this.cloudantId) {
                    geoJson.properties['@code'] = this.cloudantId;
                }
                return geoJson;
            };

            /**
             * Generates some HTML content to use in leaflet popups
             * @returns {*}
             */
            this.getPopupDescription = function () {
                var div = L.DomUtil.create('div');
                var popoverHtml = '<div class="info-heading">' + this.attributes.name + '</div>';
                var newDirective = angular.element(popoverHtml);
                angular.element(div).append(newDirective);
                return div;
            };

            this.currentScope = scope;
            this.dataProxy = this.currentScope.dataProxy;

            // internal ID, which is unique, and exists for all fences, even if they are not yet stored in the database
            this.internalId = guid();

            // cloudant ID of the geofence which is only available for fences which are already persisted in the database
            this.cloudantId = cloudantId;

            // attributes of the fence
            // modifictations on attributes are supposed to be undoable/redoable
            this.attributes = new GeofenceAttributes(
                latLng,
                radius,
                name);

            // create the leaflet artifacts for the Geofence
            this.geofenceCircle = new geofenceCircleFactory.GeofenceCircle(this.currentScope, this.internalId, this.attributes.latLng, this.attributes.radius, this.cloudantId);

            // add the fence to the map
            if (this.currentScope.geofenceMap) {
                this.currentScope.geofenceMap.addFence(this);
            }
        };

        return this;
    }

    app.factory('geofenceFactory', ['geofenceCircleFactory', '$timeout', 'geofenceAutoSave', GeofenceFactory]);
});
