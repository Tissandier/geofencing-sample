'use strict';

require.config({
    paths: {
        'angular': '../bower_components/angular/angular',
        'angular-resource': '../bower_components/angular-resource/angular-resource',
        'angularUI-bootstrap': '../bower_components/angular-bootstrap/ui-bootstrap-tpls',
        'bootstrap': '../bower_components/bootstrap/dist/js/bootstrap',
        'jquery': '../bower_components/jquery/dist/jquery',
        'leaflet': '../bower_components/leaflet-dist/leaflet-src',
        'leaflet.markercluster': '../bower_components/leaflet.markercluster/dist/leaflet.markercluster-src',
        'leaflet.draw': '../bower_components/leaflet.draw/dist/leaflet.draw-src'
    },
    shim: {
        'angular': {
            exports: 'angular'
        },
        'bootstrap': {
            deps: ['jquery']
        },
        'angularUI-bootstrap': {
            deps: ['angular', 'jquery', 'bootstrap']
        },
        'leaflet': {
            exports: 'L'
        },
        'leaflet.markercluster': {
            deps: ['leaflet'],
            exports: 'L.MarkerClusterGroup'
        },
        'leaflet.draw': {
            deps: ['leaflet'],
            exports: 'L.Control'
        }
    },

    catchError: true,

    // Enable build of requirejs-text/text
    inlineText: true
});

require(['angular'], function () {
    require(['app', 'controller'], function (app) {
        app.bootstrap();
    });
});
