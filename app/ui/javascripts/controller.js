/* global define */
'use strict';
define([
    'app',
    'angular',
    'jquery',
    'leaflet',
    'leaflet.draw',
    'geofence/geofenceDataProxy',
    'geofence/geofenceService',
    'geofence/geofenceAutoSave',
    'bootstrap',
    'angularUI-bootstrap',
    'uploadDialogController',
    'deleteDialogController'
], function (app,
             angular,
             $,
             L) {

    app.controller('mainController', [
        '$scope',
        '$timeout',
        '$http',
        '$uibModal',
        '$window',
        'geofenceDataProxy',
        'geofenceService',
        'geofenceAutoSave',
        function ($scope, $timeout, $http, $uibModal, $window, geofenceDataProxy, geofenceService, geofenceAutoSave) {

            // Function called on app init
            $scope.init = function () {

                $scope.isLoading = true;
                $scope.error = false;

                $('#name').popover();
                $('#latitude').popover();
                $('#longitude').popover();
                $('#radius').popover();

                $('#geofencesMainView').show();

                geofenceService.getAll(function (geofences) {
                    $scope.isLoading = false;
                    $scope.geofenceList = geofences.features;
                    $scope.initMap();
                }, function () {
                    $scope.isLoading = false;
                    $scope.geofenceList = [];
                    $scope.error = true;
                    $scope.initMap();
                });
            };

            // Function to init the leaflet map and its content
            $scope.initMap = function () {
                if (!$scope.leafletMap) {
                    $scope.leafletMap = L.map('map', {
                        maxZoom: 17,
                        animate: true,
                        zoomControl: false
                    });

                    new L.Control.Zoom({position: 'bottomright'}).addTo($scope.leafletMap);

                    var drawnItems = new L.FeatureGroup();
                    $scope.leafletMap.addLayer(drawnItems);
                    var drawControl = new L.Control.Draw({
                        edit: {
                            featureGroup: drawnItems
                        }
                    });
                    $scope.leafletMap.addControl(drawControl);
                }

                $scope.dataProxy = new geofenceDataProxy.GeofenceDataProxy($scope);

                $scope.syncInProgress = false; // flag to true if some save operation is in progress
            };

            // set the geofenceMap mode to add a new fence
            $scope.setAddMode = function () {
                $scope.geofenceMap.setEditMode($scope.geofenceMap.ADD_MODE);
            };

            // Display a modal askig for confirmation to delete a fence
            $scope.showDeleteModal = function () {
                var modalInstance = $uibModal.open({
                    templateUrl: 'delete.html',
                    controller: 'deleteDialogController',
                    scope: $scope,
                    size: 'sm'
                });

                modalInstance.result.then(function (result) {

                }, function () {
                    //Modal dismissed at: ' + new Date());
                });
            };

            // Function called when a fence is being removed
            $scope.onFenceRemove = function (code) {
                for (var i in $scope.geofenceList) {
                    if ($scope.geofenceList[i].properties['@code'] === code) {
                        $scope.geofenceList.splice(i, 1);
                        return;
                    }
                }
            };

            // Open the modal to import fences
            $scope.uploadFences = function () {
                $uibModal.open({
                    templateUrl: 'upload.html',
                    controller: 'uploadDialogController',
                    scope: $scope,
                    size: 'sm'
                });
            };

            // Export fences
            $scope.exportFences = function () {
                $window.open('/geofences');
            };

            // Clear the alert and info messages
            $scope.clearAlert = function () {
                $timeout(function () {
                    $scope.infoMessage = undefined;
                    $scope.errorMessage = undefined;
                });
            }
            /**
             * Method which selects a geofence on the map
             * @param geofence the geofence to select
             */
            $scope.selectGeofenceOnMap = function (geofence) {
                var fence = $scope.dataProxy.getFenceByCloudantId(geofence.properties['@code']);
                if (fence && fence.geofenceCircle) {
                    $scope.dataProxy.selectFence(fence.internalId);
                    $scope.geofenceMap.fitToGeofenceCircle(fence.geofenceCircle);
                }
                ;
            };

            /**
             * Update a geofence name in the table
             * @param code
             * @param name
             */
            $scope.updateFenceName = function (code, name){
                for (var i in $scope.geofenceList) {
                    if ($scope.geofenceList[i].properties['@code'] === code) {
                        $scope.geofenceList[i].properties.name = name;
                        return;
                    }
                }
            };

            /**
             * Callback called when selecting a fence to ensure that the corresponding row is highlighed and visible in the table.
             */
            $scope.onFenceSelect = function (fenceCode) {
                var getRowIndexByCode = function (code) {
                    var rank = 0;
                    for (var i in $scope.geofenceList) {
                        if ($scope.geofenceList[i].properties['@code'] === code) {
                            break;
                        }
                        rank++;
                    }
                    return rank;
                };

                var selectedFences = $('#geofencesListView table .selected-row');
                for (var i = 0 ; i < selectedFences.length ; i++) {
                    selectedFences[i].classList.remove('selected-row');
                }

                // The code below ensured that the selected fence was visible by scrolling as appropriate
                // But with the use of container-fluid layout, this no longer works
                if (fenceCode) {
                    // select
                    var table = $('#geofencesListView table')[0];
                    var row = table.rows[getRowIndexByCode(fenceCode)];
                    if (row) {
                        row.classList.add('selected-row');
                        var tableScrollableView = $('#geofencesListView')[0];
                        var visibleTableTop = tableScrollableView.scrollTop;
                        var visibleHeight = tableScrollableView.offsetHeight;
                        var visibleTableBottom = visibleTableTop + visibleHeight;

                        var rowTop = row.offsetTop;
                        var rowBottom = rowTop + row.offsetHeight;

                        if (rowTop < visibleTableTop) {
                            $('#geofencesListView').animate({scrollTop: rowTop}, 300);
                        } else if (rowBottom > visibleTableBottom) {
                            $('#geofencesListView').animate({scrollTop: rowBottom - visibleHeight}, 100);
                        }
                    }
                }

                $scope.onFormValueChange();
            };

            /**
             * Method invoked each time a value is changed on the form
             */
            $scope.onFormValueChange = function () {
                var name = $scope.dataProxy.selectedFence.attributes.name;
                var latitude = $scope.dataProxy.selectedFence.attributes.latLng.lat;
                var longitude = $scope.dataProxy.selectedFence.attributes.latLng.lng;
                var radius = $scope.dataProxy.selectedFence.attributes.radius;


                $scope.invalidName = ((!name) || (name.trim().length === 0));
                $scope.invalidLatitude = (isNaN(parseFloat(latitude)) || (latitude < -90) || (latitude > 90));
                $scope.invalidLongitude = (isNaN(parseFloat(longitude)) || (longitude < -180) || (longitude > 180));
                $scope.invalidRadius = (isNaN(parseFloat(radius)) || (radius < 100) || (radius > 10000));

                $scope.dataProxy.selectedFence.refresh();
            }

            /**
             * Callback called when a fence is being changed to save the changes
             */
            $scope.watchSync = false; // flag to ensure that we only have a single $watch call for every modified fence
            $scope.syncInProgress = false; // flag to true if some save operation is in progress
            // Function called when a fence is being changed
            $scope.onFenceUpdate = function (code, latLng, radius, name) {
                if (!$scope.watchSync) {
                    $scope.watchSync = true;
                    $scope.$watch(function () {
                        return geofenceAutoSave.hasPendingRequests();
                    },
                    function () {
                        $scope.syncInProgress = geofenceAutoSave.hasPendingRequests();
                    });
                }
                geofenceAutoSave.getSaveHandler(code).save(
                    latLng,
                    radius,
                    name
                );
            };

            /**
             * Determines if the page can be unloaded
             */
            function unload(event) {
                if (geofenceAutoSave.hasPendingRequests()) {
                    var message ='Some changes have not been saved yet.';
                    /* global window */
                    (event || window.event).returnValue = message;
                    return message;
                }
            }

            $window.addEventListener('beforeunload', unload);

            $scope.$on('$destroy', function () {
                // Clean up the event listener when the scope is destroyed
                $window.removeEventListener('beforeunload', unload);
            });
        }]);

    return app;
});
