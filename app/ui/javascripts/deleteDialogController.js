/* global define */
'use strict';
define([
    'app',
    'geofence/geofenceAutoSave'
], function (app) {

    /**
     * Controller for the modal that allows the user to delete a fence
     */
    return app.controller('deleteDialogController', [
        '$scope',
        '$uibModalInstance',
        'geofenceAutoSave',
        function ($scope, $uibModalInstance, geofenceAutoSave) {
            $scope.ok = function () {
                $scope.showSpinner = true;
                // wait for all update requests to be fullfilled
                geofenceAutoSave.waitForPendingRequests()
                    .then(function () {
                        $scope.$parent.dataProxy.removeFence($scope.$parent.dataProxy.selectedFence.internalId)
                            .then(function() {
                                $scope.showSpinner = false;
                                $uibModalInstance.close();
                            },
                                function() {
                                    $scope.showSpinner = false;
                                    $scope.$parent.errorMessage = 'The fence deletion failed';
                                    $uibModalInstance.close();
                                }
                            );
                    });

            };

            $scope.cancel = function () {
                $uibModalInstance.dismiss('cancel');
            };
        }
    ]);
});
