/* global define */
'use strict';
define([
    'app',
    'jquery',
    'geofence/geofenceHandles'
], function (app, $) {

    /* global L */

    function GeofenceCircleFactory($timeout, geofenceHandlesFactory) {
        //---------------------------------------------
        // Constructor of a geofence circle
        //_____________________________________________
        this.GeofenceCircle = function (scope, id, latLng, radius, cloudantId) {

            /**
             *  returns true if the fence is too small wrt to the ratio argument.
             */
            this.tooSmall = function (ratio) {
                var mapBounds = scope.leafletMap.getBounds();
                var visibleDiag = mapBounds.getNorthWest().distanceTo(mapBounds.getSouthEast());
                return (visibleDiag > ratio * this.circle.getRadius());
            };

            /**
             * Returns true if the fence is too small to display the handles
             */
            this.shouldHideHandles = function () {
                return this.tooSmall(20);
            };

            /**
             * Update the cursor
             */
            var updateCursor = function () {
                if (this.isSelected) {
                    $('.leaflet-clickable').css('cursor', '-webkit-grab');
                } else {
                    var currentEditMode = this.dataProxy.geofenceMap.getEditMode();
                    if (currentEditMode === this.dataProxy.geofenceMap.ADD_MODE) {
                        $('.leaflet-clickable').css('cursor', 'not-allowed');
                    } else {
                        $('.leaflet-clickable').css('cursor', 'pointer');
                    }
                }
            }.bind(this);


            /**
             * onMouseClick function
             * used to select geofences, set the appropriate cursor for the current edit mode.
             * if the geofence is already selected we fit the fence to the view
             */
            var onMouseClick = function (/*e*/) {
                if (!this.dataProxy.geofenceMap.isAFenceCurrentlyEdited()) {
                    $timeout( function () {
                        if ((!this.dataProxy.selectedFence) || (this.dataProxy.selectedFence.internalId !== this.internalId)) {
                            this.dataProxy.selectFence(this.internalId);
                        } else {
                            this.fitView();
                        }
                    }.bind(this));
                }
                updateCursor();
            }.bind(this);

            /**
             * onMouseDoubleClick
             * Used to select geofences, set the appropriate cursor for the current edit mode.
             * and fit the fence to the view
             */
            var onMouseDoubleClick = function (/*e*/) {
                if (!this.dataProxy.geofenceMap.isAFenceCurrentlyEdited()) {
                    this.dataProxy.selectFence(this.internalId);
                    this.fitView();
                }
                updateCursor();
            }.bind(this);

            /**
             * Fit the view to this geofence
             */
            this.fitView = function () {
                this.dataProxy.geofenceMap.fitToGeofenceCircle(this);
            };

            /**
             * Update the display of edit handles
             */
            this.updateDisplay = function () {
                if (this.isSelected) {
                    this.hideMarker();
                    if (this.handles.handlesDisplayed) {
                        this.handles.refresh();
                    } else {
                        this.handles.show();
                    }
                }
            };

            /**
             * Select the geofence
             */
            this.select = function () {
                this.handles.show();
                if (!this.isSelected) {
                    this.isSelected = true;
                    this.setColor(this.selectedColor);

                    // flag to watch if an edition is in progress
                    this.editing = false;
                }
            };

            /**
             * Unselect the geofence
             */
            this.unSelect = function () {
                // unSelect a geofence: remove decorations
                if (this.isSelected) {
                    this.showMarker();
                    this.handles.hide();
                    this.setColor(this.color);
                    this.isSelected = false;
                    this.handles.hide();
                    this.marker.closePopup();
                    this.marker.unbindPopup();
                }
            };
            /**
             * Set/unsets a fence in 'editing' scope
             * @param editing
             */
            this.setEditing = function (editing) {
                this.editing = editing;
            };

            /**
             * Returns true if the fence is currently being edited
             * @returns {boolean}
             */
            this.isEditing = function () {
                return this.editing;
            };

            /**
             * Move the geofence to a new position
             * @param newLatLng
             */
            this.move = function (newLatLng) {
                // Move the geofence
                this.circle.setLatLng(L.latLng(newLatLng.lat, newLatLng.lng));
                this.marker.setLatLng(L.latLng(newLatLng.lat, newLatLng.lng));
                if (this.isSelected) {
                    this.handles.refresh();
                }
            };

            /**
             * Resize the geofence
             * @param newRadius
             */
            this.setRadius = function (newRadius) {
                // Set the geofence radius
                this.circle.setRadius(newRadius);
                this.updateDisplay();
            };

            /**
             * Show the ghost circle used when dragging a resize handle
             * @param ghostLatLng
             * @param ghostRadius
             */
            this.showGhost = function (ghostLatLng, ghostRadius) {
                if (!this.isGhostVisible) {
                    this.circle.setStyle({
                        color: this.selectedColor,
                        fillColor: this.selectedColor
                    });
                }
                ;
                this.ghostCircle.setRadius(ghostRadius);
                this.ghostCircle.setLatLng(ghostLatLng);
                if (!this.isGhostVisible) {
                    this.isGhostVisible = true;
                    this.currentScope.leafletMap.addLayer(this.ghostCircle);
                }
                if (this.isSelected) {
                    this.handles.refresh();
                }
            };

            /**
             * Hide the ghost circle
             */
            this.hideGhost = function () {
                if (this.isGhostVisible) {
                    this.isGhostVisible = false;
                    this.currentScope.leafletMap.removeLayer(this.ghostCircle);
                }
                if (this.isSelected) {
                    this.handles.refresh();
                }
            };

            /**
             * Set the color of the geofence
             */
            this.setColor = function (color) {
                // Set the geofence color
                this.circle.setStyle({
                    color: color,
                    fillColor: color
                });
            };

            /**
             * Remove the geofence
             */
            this.remove = function () {
                // Remove the geofence from the map
                this.handles.hide();
                this.marker.closePopup();
                this.marker.unbindPopup();
                this.dataProxy.geofenceMap.removeGeofence(this);

            };

            /**
             * Show the marker in the center of the circle
             */
            this.showMarker = function () {
                this.marker.setOpacity(1, true);

                //  we must perform this check to ensure that leaflet will not throw an exception
                if ((this.marker.dragging) && (this.marker._icon)) {
                    if (this.currentScope.geofenceMap.getEditMode() === this.dataProxy.geofenceMap.EDIT_MODE) {
                        this.marker.dragging.enable();
                    } else {
                        this.marker.dragging.disable();
                    }
                }
            };

            /**
             * Hide the marker in the center of the circle
             */
            this.hideMarker = function () {
                this.marker.setOpacity(0, true);
            };

            //--------------------------------------
            // Initialization
            //--------------------------------------

            this.currentScope = scope;
            this.dataProxy = this.currentScope.dataProxy;

            this.isSelected = false; // boolean stating if the circle is selected
            this.centerMarker = null; // marker that can be dragged to move the fence

            // UUID for this fence
            this.internalId = id;

            // cloudantId of the fence, only available for fences already stored in Cloudant
            this.cloudantId = cloudantId;

            this.color = this.currentScope.FENCE_COLOR;
            this.selectedColor = this.currentScope.SELECTED_FENCE_COLOR;

            // create a leaflet circle
            this.circle = L.circle(L.latLng(latLng.lat, latLng.lng), radius, {
                color: this.color,
                fillColor: this.color,
                fillOpacity: 0.3,
                weight: 2,
                clickable: true
            });
            this.circle.on('click', onMouseClick);
            this.circle.on('doubleclick', onMouseDoubleClick);
            this.circle.on('mouseover', function () {
                //update the cursor and display the popup if needed on the circle
                updateCursor();
                if (this.isSelected && !this.shouldHideHandles()) {
                    var popupMessage = this.currentScope.dataProxy.getFence(this.internalId).getPopupDescription();
                    this.circle.bindPopup(popupMessage, {closeButton: false});

                    // Compute the popup location to have it displayed on top of the circle
                    var popupLocation = this.circle._latlng;
                    if (popupLocation) {
                        // adjust radius for zoom
                        var zoom = this.currentScope.leafletMap.getZoom();

                        var newrad = this.circle._radius;
                        if (zoom > 0) {
                            newrad = newrad / (1 * Math.pow(2, zoom));
                        }
                        else if (zoom < 0) {
                            newrad = newrad * (1 * Math.pow(2, (Math.abs(zoom))));
                        }
                        var lat = (popupLocation.lat + newrad);
                        popupLocation = {lat: lat, lng: popupLocation.lng}; // position over the top of the circle
                    }
                    this.circle.openPopup(popupLocation);
                }
            }.bind(this));
            this.circle.on('mouseout', function () {
                // update the cursor and hide the circle popup if needed
                var currentEditMode = this.dataProxy.geofenceMap.getEditMode();
                if (currentEditMode === this.dataProxy.geofenceMap.EDIT_MODE) {
                    $('.leaflet-clickable').css('cursor', 'pointer');
                } else if (currentEditMode === this.dataProxy.geofenceMap.ADD_MODE) {
                    $('.leaflet-clickable').css('cursor', 'not-allowed');
                }
                this.circle.closePopup();
            }.bind(this));
            this.circle.on('mouseover', updateCursor);

            // create a leaflet marker that will be used when the circle is NOT selected
            var CenterMarker = L.Marker.extend({
                setOpacity: function (opacity, fromApp) {
                    if (fromApp === true) {
                        L.Marker.prototype.setOpacity.call(this, opacity);
                    }
                }
            });

            this.marker = new CenterMarker(latLng, {
                clickable: true,
                icon: this.currentScope.geofenceMap.normalGeofenceIcon
            });
            this.marker.on('click', onMouseClick);
            this.marker.on('doubleclick', onMouseDoubleClick);
            this.marker.on('mouseover', function () {
                // update the cursor and display the popup if needed on the marker
                updateCursor();
                if (!(this.isSelected && !this.shouldHideHandles())) {
                    var popupMessage = this.currentScope.dataProxy.getFence(this.internalId).getPopupDescription();
                    this.marker.bindPopup(popupMessage, {closeButton: false});
                    this.marker.openPopup();
                }
            }.bind(this));
            this.marker.on('mouseout', function () {
                // hide the marker popup if needed
                this.marker.closePopup();
            }.bind(this));

            this.handles = new geofenceHandlesFactory.GeofenceHandles(this);

            // create a ghost leaflet circle
            this.ghostCircle = L.circle(latLng, radius, {
                fillOpacity: 0.1,
                dashArray: [3, 3],
                weight: 2,
                clickable: true
            });
            this.isGhostVisible = false;
        };
        return this;
    };

    app.factory('geofenceCircleFactory', ['$timeout', 'geofenceHandlesFactory', GeofenceCircleFactory]);
});
