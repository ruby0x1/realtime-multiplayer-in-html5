'use strict';

// Declare app level module which depends on views, and components
angular.module('gameApp', [
    'ngRoute',
    'gameApp.lobby',
    'gameApp.gameplay'
]).
config(['$routeProvider', function($routeProvider) {
    $routeProvider.otherwise({redirectTo: '/lobby'});
}]);