/* global define */
'use strict';
define([
    'app'
], function (app) {

    /**
     * THe following code interacts with the REST services to create, update, import and delete fences
     * @param $resource
     * @returns {*}
     */
    function geofenceService($resource) {
        var Geofences = $resource('/geofences/:geofence', undefined, {
            create: {
                method: 'POST'
            },
            update: {
                method: 'PUT'
            },
            delete: {
                method: 'DELETE',
                isArray: false
            },
            getAll: {
                method: 'GET',
                isArray: false,
                url: '/geofences'
            }
        });

        return Geofences;
    }


    app.factory('geofenceService', ['$resource', geofenceService]);
});
