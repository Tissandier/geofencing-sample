/* global define */
'use strict';
define([
    'app',
    'jquery'
], function (app, $) {


    /* global L */

    /**
     * Utility method to shift a lat long position by a vector expressed in meters
     */
    var translatePosByMeters = function (latLng, m) {
        var pi = Math.PI;
        //Earth’s radius, sphere
        var Radius = 6378137;
        // latLng to transform
        var lat = latLng[0] || latLng.lat;
        var lng = latLng[1] || latLng.lng;

        //Coordinate offsets in radians
        var dLng = m[0] / (Radius * Math.cos(pi * lat / 180) );
        var dLat = m[1] / Radius;

        //OffsetPosition, decimal degrees
        lat = lat + ( dLat * 180 / pi );
        lng = lng + ( dLng * 180 / pi );

        return L.latLng(lat, lng);
    };

    function GeofenceHandleFactory() {
        //---------------------------------------------
        // Constructor of geofence handles
        //_____________________________________________
        this.GeofenceHandles = function (geofenceCircle) {

            this.geofenceCircle = geofenceCircle;
            this.handlesDisplayed = false;

            /**
             * updateCursor as appropriate
             */
            var updateCursor = function () {
                var currentEditMode = this.dataProxy.geofenceMap.getEditMode();
                if ((currentEditMode === this.dataProxy.geofenceMap.EDIT_MODE)
                    || (currentEditMode === this.dataProxy.geofenceMap.UPLOAD_MODE)) {
                    $('.leaflet-clickable').css('cursor', 'pointer');
                } else if (currentEditMode === this.dataProxy.geofenceMap.ADD_MODE) {
                    $('.leaflet-clickable').css('cursor', 'not-allowed');
                }
            }.bind(this);

            /**
             * Function which computes the positions of handles
             */
            var computeRadiusMarkersLatLng = function () {
                var circleLatLng = this.geofenceCircle.circle.getLatLng();
                var circleRadius = this.geofenceCircle.circle.getRadius();

                var positions = [];
                positions.push(translatePosByMeters(circleLatLng, [circleRadius, 0]));
                positions.push(translatePosByMeters(circleLatLng, [0, circleRadius]));
                positions.push(translatePosByMeters(circleLatLng, [-circleRadius, 0]));
                positions.push(translatePosByMeters(circleLatLng, [0, -circleRadius]));

                return positions;

            }.bind(this);

            /**
             * Show the handles
             */
            this.show = function () {
                if (this.handlesDisplayed === false) {
                    this.handlesDisplayed = true;
                    this.geofenceCircle.hideMarker();

                    var dragStart = function (/*e*/) {
                        this.geofenceCircle.setEditing(true);
                    }.bind(this);

                    var circleLatLng = this.geofenceCircle.circle.getLatLng();
                    // Decorate with a marker to set the radius and a marker to move its center
                    this.centerMarker = L.marker(circleLatLng, {
                        clickable: 'true',
                        draggable: this.dataProxy.geofenceMap.getEditMode() === this.dataProxy.geofenceMap.EDIT_MODE,
                        icon: this.dataProxy.geofenceMap.getEditMode() === this.dataProxy.geofenceMap.EDIT_MODE ?
                            this.geofenceCircle.currentScope.geofenceMap.handleGeofenceIcon :
                            this.geofenceCircle.currentScope.geofenceMap.selectedGeofenceIcon
                    });
                    this.centerMarker.addTo(this.currentScope.leafletMap);
                    this.centerMarker.on('drag', function (event) {
                        if (this.dataProxy.geofenceMap.getEditMode() === this.dataProxy.geofenceMap.EDIT_MODE) {
                            this.geofenceCircle.showGhost(event.target.getLatLng(), this.geofenceCircle.circle.getRadius());
                        }
                    }.bind(this));
                    this.centerMarker.on('dragstart', dragStart);
                    this.centerMarker.on('dragend', function (/*event*/) {
                        this.ignoreNextClickEvent = true;
                        this.geofenceCircle.hideGhost();
                        this.geofenceCircle.setEditing(false);
                        if (this.dataProxy.geofenceMap.getEditMode() === this.dataProxy.geofenceMap.EDIT_MODE) {
                            this.dataProxy.getFence(this.geofenceCircle.internalId).move(this.geofenceCircle.ghostCircle.getLatLng());
                        }
                    }.bind(this));
                    this.centerMarker.on('mouseover', function () {
                        // update the cursor and display the popup if needed
                        updateCursor();
                        if (this.geofenceCircle.shouldHideHandles()) {
                            var popupMessage = this.currentScope.dataProxy.getFence(this.geofenceCircle.internalId).getPopupDescription();
                            this.centerMarker.bindPopup(popupMessage, {closeButton: false});
                            this.centerMarker.openPopup();
                        }
                    }.bind(this));
                    this.centerMarker.on('mouseout', this.centerMarker.closePopup);
                    this.centerMarker.on('click', function (/*event*/) {
                        if (this.ignoreNextClickEvent) {
                            this.ignoreNextClickEvent = false;
                        } else {
                            this.geofenceCircle.fitView();
                        }
                    }.bind(this));

                    var sanitizeRadius = function (radius) {
                        return (radius < this.currentScope.minRadius) ? this.currentScope.minRadius
                            : ((radius > this.currentScope.maxRadius) ? this.currentScope.maxRadius
                            : radius);
                    }.bind(this);

                    // Compute latlng prosition on the outline of the circle
                    var positions = computeRadiusMarkersLatLng();
                    var onRadiusDrag = function (event) {
                        if (this.dataProxy.geofenceMap.getEditMode() === this.dataProxy.geofenceMap.EDIT_MODE) {
                            var position = event.target.getLatLng();
                            var newRadius = this.geofenceCircle.circle.getLatLng().distanceTo(position);
                            this.geofenceCircle.showGhost(this.geofenceCircle.circle.getLatLng(), sanitizeRadius(newRadius), position);
                        }
                    }.bind(this);
                    var onRadiusDragEnd = function (/*event*/) {
                        this.geofenceCircle.hideGhost();
                        this.geofenceCircle.setEditing(false);
                        if (this.dataProxy.geofenceMap.getEditMode() === this.dataProxy.geofenceMap.EDIT_MODE) {
                            var newRadius = this.geofenceCircle.ghostCircle.getRadius();
                            this.dataProxy.getFence(this.geofenceCircle.internalId).setRadius(sanitizeRadius(newRadius));
                            if (this.geofenceCircle.shouldHideHandles()) {
                                this.hide();
                                this.geofenceCircle.showMarker();
                            }
                        }
                    }.bind(this);

                    for (var i = 0; i < 4; i++) {
                        this.radiusMarkers[i] = L.marker(positions[i], {
                            draggable: 'true',
                            icon: this.geofenceCircle.currentScope.geofenceMap.handleGeofenceIcon
                        });
                        this.radiusMarkers[i].addTo(this.currentScope.leafletMap);
                        this.radiusMarkers[i].on('drag', onRadiusDrag);
                        this.radiusMarkers[i].on('dragstart', dragStart);
                        this.radiusMarkers[i].on('dragend', onRadiusDragEnd);
                        this.radiusMarkers[i].on('mouseover', updateCursor);
                    }
                }

                this.refresh();
            };

            /**
             * Hide the handles
             */
            this.hide = function () {
                if (this.handlesDisplayed) {
                    this.currentScope.leafletMap.removeLayer(this.centerMarker);
                    this.centerMarker = null;
                    for (var i = 0; i < 4; i++) {
                        this.currentScope.leafletMap.removeLayer(this.radiusMarkers[i]);
                    }
                    this.radiusMarkers = [];
                    this.handlesDisplayed = false;
                }
            };

            /**
             * Refresh the display of handles and circle
             */
            this.refresh = function () {
                if (this.handlesDisplayed) {
                    this.geofenceCircle.hideMarker();
                    var circlePos;
                    if (this.geofenceCircle.isGhostVisible) {
                        circlePos = this.geofenceCircle.ghostCircle.getLatLng();
                    } else {
                        circlePos = this.geofenceCircle.circle.getLatLng();
                    }

                    this.centerMarker.setLatLng(circlePos);
                    var positions = computeRadiusMarkersLatLng();
                    for (var i = 0; i < 4; i++) {
                        this.radiusMarkers[i].setLatLng(positions[i]);
                    }

                    // Set the handles draggable only if in EDIT_MODE
                    // and hide the radius markers id not in EDIT_MODE
                    if ((this.dataProxy.geofenceMap.getEditMode() === this.dataProxy.geofenceMap.EDIT_MODE) && (!this.geofenceCircle.shouldHideHandles())) {
                        this.centerMarker.setIcon(this.geofenceCircle.currentScope.geofenceMap.handleGeofenceIcon);
                        for (var i = 0; i < 4; i++) {
                            this.radiusMarkers[i].setOpacity(1);
                        }
                    } else {
                        this.centerMarker.setIcon(this.geofenceCircle.currentScope.geofenceMap.selectedGeofenceIcon);
                        for (var i = 0; i < 4; i++) {
                            this.radiusMarkers[i].setOpacity(0);
                        }
                    }
                }
            };

            //--------------------------------------
            // Initialization
            //--------------------------------------
            this.currentScope = geofenceCircle.currentScope;
            this.dataProxy = this.currentScope.dataProxy;
            this.centerMarker = null; // marker that can be dragged to move the fence
            this.radiusMarkers = []; // Array of four markers that can be dragged to resize the fence
        };
        return this;
    };

    app.factory('geofenceHandlesFactory', [GeofenceHandleFactory]);
});
