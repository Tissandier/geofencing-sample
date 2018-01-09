/* global define */
'use strict';
define([
    'app',
    'jquery'
], function (app, $) {

    var controllerScope = null;

    var Model = function (radius) {
        var defaultRadius = radius;
        this.defaultGeofenceName = 'Unnamed geofence';

        this.__defineGetter__('defaultRadius', function () {
            return defaultRadius;
        });

        this.__defineSetter__('defaultRadius', function (val) {
            val = parseInt(val);
            defaultRadius = val;
        });
    };

    app.directive('filechange', function () {
        return {
            scope: {
                file: '='
            },
            link: function ($scope, el/*, attrs*/) {
                el.bind('change', function (event) {
                    var files = event.target.files;
                    var file = files[0];
                    controllerScope.filename = file ? file.name : undefined;
                    controllerScope.$apply();
                });
            }
        };
    });

    /**
     * Controller for the modal that allows the user to load a geoJSON file
     */
    return app.controller('uploadDialogController', [
        '$scope',
        '$uibModalInstance',
        function ($scope, $uibModalInstance) {
            controllerScope = $scope;
            $scope.model = new Model(1000);
            $scope.model.defaultRadius = 200;

            $scope.uploadGeojson = function () {
                $scope.showSpinner = true;
                var file = $('#file')[0];

                /* global FileReader */
                var r = new FileReader();
                r.onloadend = function (e) {
                    try {
                        var parsedResult = JSON.parse(e.target.result)
                        $scope.$parent.dataProxy.loadGeoJSON(parsedResult, $scope.model.defaultRadius, $scope.model.defaultGeofenceName);
                        var nFencesToImport = $scope.$parent.dataProxy.lastUploadPayload.features.length;
                        if (nFencesToImport === 0) {
                            $scope.$parent.errorMessage = 'The GeoJSON file contains 0 fence';
                            $scope.$parent.geofenceMap.setEditMode($scope.geofenceMap.EDIT_MODE);
                        } else if (nFencesToImport === 1) {
                            $scope.$parent.infoMessage = 'The GeoJSON file contains 1 geofence to import';
                        } else {
                            $scope.$parent.infoMessage = 'The GeoJSON file contains ' + nFencesToImport + ' geofences to import';
                        }
                    } catch (err) {
                        $scope.$parent.errorMessage = 'The GeoJSON file content is invalid';
                        $scope.$parent.geofenceMap.setEditMode($scope.geofenceMap.EDIT_MODE);
                    } finally {
                        $uibModalInstance.close();
                        $scope.showSpinner = false;
                    }
                };
                r.readAsBinaryString(file.files[0]);
            };

            $scope.cancel = function () {
                $uibModalInstance.dismiss('cancel');
            };

            $scope.disableOK = function () {
                return (typeof $scope.filename === 'undefined');
            };
        }
    ]);
});
