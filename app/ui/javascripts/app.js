/* global define */
'use strict';
define([
    'angular',
    'bootstrap',
    'angularUI-bootstrap',
    'angular-resource'
], function (angular) {
    var app = angular.module('geofencing-sample', ['ui.bootstrap', 'ngResource']);

    // function that bootstraps the angular app
    app.bootstrap = function () {
        /* global document */
        angular.bootstrap(document, ['geofencing-sample']);
    };
    return app;
});
