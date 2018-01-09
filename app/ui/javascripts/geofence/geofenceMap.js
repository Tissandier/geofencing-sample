/* global define */
'use strict';
define([
    'app',
    'jquery',
    'leaflet.markercluster'
], function (app, $) {
    /* global L */

    var OSM_TILES = 0;

    var TileDesc = function (id) {
        this.id = id;
        if (id === OSM_TILES) {
            this.url = '//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
            this.options = {
                attribution: '&copy; <a href=\'http://www.openstreetmap.org/copyright\'>OpenStreetMap</a> contributors'
            };
        }
    };
    //---------------------------------------------
    // GeofenceMap object used to manage the leaflet map
    // Constructor
    //---------------------------------------------
    function GeofenceMap($timeout) {

        this.GeofenceMap = function (scope) {
            //console.log('Initializing GeofenceMap for ' + scope.id);

            this.getDataProxy = function () {
                return this.currentScope.dataProxy;
            };

            //-------------------------------
            // Edit mode management
            //-------------------------------
            this.NO_MODE = 0;		// no interaction with the fences
            this.ADD_MODE = 1;		// clicing on the map adds a fence
            this.EDIT_MODE = 2;	// hovering a fence selects it and displays markers to edit it
            this.UPLOAD_MODE = 3;	// upload mode

            var editMode = this.EDIT_MODE; // default mode

            /**
             * Set the drawer if needed, based on the current edit mode.
             */
            this.setDrawer = function () {
                if (editMode === this.ADD_MODE) {
                    $timeout(function () {
                        this.geofenceDrawer.enable();
                    }.bind(this));
                } else {
                    $timeout(function () {
                        this.geofenceDrawer.disable();
                    }.bind(this));
                }
            };

            /**
             * Set the edit mode
             */
            this.setEditMode = function (mode) {
                editMode = mode >= 4 ? this.NO_MODE : mode;
                if (editMode !== this.EDIT_MODE) {
                    this.resetSelection();
                }

                this.setDrawer();

                var circles = this.getLeafletCircles();
                var allowClick = editMode !== this.NO_MODE;
                circles.forEach(function (circle) {
                    circle.setStyle({clickable: allowClick});
                });

                if (this.getDataProxy().selectedFence) {
                    this.getDataProxy().selectedFence.select();
                }
            };

            /**
             * Get the edit mode
             */
            this.getEditMode = function () {
                return editMode;
            };

            this.handleGeofenceIcon = L.icon({
                iconUrl: 'images/handle-icon.png',
                iconRetinaUrl: 'images/handle-icon-2x.png',
                iconSize: [22, 22], // size of the icon
                iconAnchor: [11, 11], // point of the icon which will correspond to marker's location
                popupAnchor: [0, 11] // point from which the popup should open relative to the iconAnchor
            });

            this.normalGeofenceIcon = L.icon({
                iconUrl: 'images/normal-geofence-marker-icon.png',
                iconRetinaUrl: 'images/normal-geofence-marker-icon-2x.png',
                iconSize: [38, 45], // size of the icon
                iconAnchor: [19, 45], // point of the icon which will correspond to marker's location
                popupAnchor: [1, -40] // point from which the popup should open relative to the iconAnchor
            });

            this.selectedGeofenceIcon = L.icon({
                iconUrl: 'images/selected-geofence-marker-icon.png',
                iconRetinaUrl: 'images/selected-geofence-marker-icon-2x.png',
                iconSize: [38, 45], // size of the icon
                iconAnchor: [19, 45], // point of the icon which will correspond to marker's location
                popupAnchor: [1, -40] // point from which the popup should open relative to the iconAnchor
            });

            this.hiddenIcon = new L.Icon({
                iconUrl: 'images/normal-geofence-marker-icon.png',
                iconSize: [1, 1],
                iconAnchor: [1, 1],
                popupAnchor: [1, 1],
                shadowSize: [1, 1]
            });

            /**
             * Unselect the current fence if any.
             */
            this.resetSelection = function () {
                if (this.getDataProxy().selectedFence) {
                    this.getDataProxy().selectedFence.unSelect();
                }
            };

            /**
             * Returns a boolean stating if an geofence is currently being edited
             * @returns {boolean}
             */
            this.isAFenceCurrentlyEdited = function () {
                return ((this.currentScope.selectedFence) && (this.currentScope.selectedFence.geofenceCircle.editing));
            };

            /**
             * Add a a fence to the map
             * @param fence
             */
            this.addFence = function (fence) {
                this.geofencesCluster.addLayer(fence.geofenceCircle.marker);
                this.leafletMap.addLayer(fence.geofenceCircle.circle);
            };

            /**
             * Remove a geofence from the map
             */
            this.removeGeofence = function (geofenceCircle) {
                this.getDataProxy().unSelect(geofenceCircle.internalId);
                if (geofenceCircle.handles) {
                    geofenceCircle.handles.hide();
                }
                if (this.geofencesCluster) {
                    this.geofencesCluster.removeLayer(geofenceCircle.marker);
                }
                if (this.leafletMap) {
                    this.leafletMap.removeLayer(geofenceCircle.circle);
                }
            };

            /**
             * returns an array of the leaflet circles
             * @returns {Array}
             */
            this.getLeafletCircles = function () {
                var ret = [];

                if (this.getDataProxy().fences) {
                    Object.keys(this.getDataProxy().fences).forEach(function (i) {
                        ret.push(this.getDataProxy().fences[i].geofenceCircle.circle);
                    }.bind(this));
                }
                return ret;
            };

            /**
             * Fit the view to the current content
             * @param onSelectedFence if set to true, the fit will only zoom to the selected geofence
             */
            this.fitToContent = function (onSelectedFence) {
                this.leafletMap.invalidateSize(true);
                if ((onSelectedFence) && (this.getDataProxy().selectedFence)) {
                    this.fitToGeofenceCircle(this.getDataProxy().selectedFence.geofenceCircle);
                } else {
                    var circles = this.getLeafletCircles();
                    if (circles.length > 0) {
                        var group = L.featureGroup(circles);
                        var bounds = group.getBounds();

                        var currentBounds = bounds;
                        try {
                            currentBounds = this.leafletMap.getBounds(); // first call always fail because there is no map center and zoom level set.
                        } catch (e) {

                        }

                        if (circles.length === 1) {
                            bounds = bounds.pad(0.25);
                        }
                        this.leafletMap.fitBounds(bounds, {
                            reset: !currentBounds.intersects(bounds),
                            animate: currentBounds.intersects(bounds)
                        });
                    } else {
                        this.leafletMap.fitWorld().zoomIn();
                    }
                }
            };

            /**
             * Fit the view to a given fence
             * @param fence
             */
            this.fitToGeofenceCircle = function (fence) {
                var currentBounds = this.leafletMap.getBounds();
                var circleBounds = fence.circle.getBounds();
                this.leafletMap.fitBounds(circleBounds.pad(0.25), {
                    reset: !currentBounds.intersects(circleBounds),
                    animate: currentBounds.intersects(circleBounds)
                });
            };

            /**
             * Simply add a leaflet layer to the marker cluster
             * Note: only the geofence marker are added to the cluster
             */
            this.addToCluster = function (item) {
                this.geofencesCluster.addLayer(item);
            };
            /**
             * Simply remove a leaflet layer from the marker cluster
             * @param item
             */
            this.removeFromCluster = function (item) {
                this.geofencesCluster.removeLayer(item);
            };

            /**
             * Sets the tile layers
             */
            this.updateTiles = function () {
                if (typeof this.currentTileLayer !== 'undefined') {
                    this.leafletMap.removeLayer(this.currentTileLayer);
                }
                if (!this.currentLayerDesc) {
                    this.currentLayerDesc = new TileDesc(OSM_TILES);
                }
                this.currentTileLayer = L.tileLayer(this.currentLayerDesc.url, this.currentLayerDesc.options);
                this.currentTileLayer.addTo(this.leafletMap);
            };

            //--------------------------------------
            // Initialization
            //--------------------------------------
            this.setLeafletMap = function (leafletMap) {
                this.leafletMap = leafletMap;
            };

            /**
             * Init the layers
             */
            this.initLayers = function () {
                this.leafletMap.eachLayer(function (layer) {
                    this.leafletMap.removeLayer(layer);
                }.bind(this));

                this.geofencesCluster = L.markerClusterGroup({
                    animateAddingMarkers: false,
                    disableClusteringAtZoom: 13
                }); // if animateAddingMarkers is true, we get exception 'layer._setPos is not a function'
                this.leafletMap.addLayer(this.geofencesCluster);
                this.updateTiles();
            };

            /**
             * INITIALIZATION  (once the dataproxy and the leaflet map are initialized)
             */
            this.currentScope = scope;
            this.getDataProxy().geofenceMap = this;
            this.leafletMap = this.currentScope.leafletMap;

            L.Draw.Geofence = L.Draw.Marker.extend({
                initialize: function (map, options) {
                    this.type = 'geofence';
                    L.Draw.Feature.prototype.initialize.call(this, map, options);
                },
                addHooks: function () {
                    L.Draw.Marker.prototype.addHooks.call(this);
                    if (this._map) {
                        this._tooltip.updateContent({text: 'Click to drop a geofence'});
                    }
                }
            });

            this.geofenceDrawer = new L.Draw.Geofence(this.leafletMap, {icon: this.selectedGeofenceIcon});

            this.leafletMap.on('draw:created', function (e) {
                // calback to create a geofence
                var latlng = e.layer._latlng;

                var bounds = this.leafletMap.getBounds();
                var radius = bounds.getNorthWest().distanceTo(bounds.getSouthWest()) / 8; // compute the radius so that the fence gets a reasonable visible size for all zoom levels
                radius = radius > this.currentScope.dataProxy.maxRadius ? this.currentScope.dataProxy.maxRadius : radius; // Set max radius to 10 kms
                radius = radius < this.currentScope.dataProxy.minRadius ? this.currentScope.dataProxy.minRadius : radius; // Set min radius
                if ((editMode === this.ADD_MODE) && (Math.abs(latlng.lat) <= 90)) {

                    this.currentScope.geofenceMap.setEditMode(this.currentScope.geofenceMap.EDIT_MODE);
                    var fence = this.currentScope.dataProxy.addFence(
                        this.currentScope.dataProxy.sanitizeLatLng(latlng),
                        radius);

                    this.currentScope.dataProxy.persistFence(fence);

                    this.currentScope.geofenceMap.fitToContent(true);
                }
            }.bind(this));
            /* global document*/
            $(document).keyup(function (e) {
                if (e.keyCode === 27) {
                    // ESC key pressed
                    if (editMode === this.ADD_MODE) {
                        this.setEditMode(this.EDIT_MODE);
                    }
                }
            }.bind(this));

            this.leafletMap.on('mouseout', function () {
                this.geofenceDrawer.disable();
            }.bind(this));
            this.leafletMap.on('mouseover', this.setDrawer.bind(this));

            this.leafletMap.on('viewreset', function () {
                if (this.getDataProxy().selectedFence) {
                    this.getDataProxy().selectFence(this.getDataProxy().selectedFence.internalId);
                }
            }.bind(this));

            this.initLayers();

            var selectedFenceStillThere = false;
            Object.keys(this.getDataProxy().fences).forEach(function (i) {
                this.addFence(this.getDataProxy().fences[i]);

                // if a fence is already selected, the internal ID will be reinitialized
                if (this.getDataProxy().selectedFence &&
                    (this.getDataProxy().selectedFence.cloudantId === this.getDataProxy().fences[i].cloudantId)) {
                    this.getDataProxy().selectedFence = this.getDataProxy().fences[i];
                    selectedFenceStillThere = true;
                }
            }.bind(this));

            if (!selectedFenceStillThere) {
                this.getDataProxy().selectedFence = undefined;
            }
            return this;
        };

        return this;
    };

    app.factory('geofenceMap', ['$timeout', GeofenceMap]);

});
