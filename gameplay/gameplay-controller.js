'use strict';

angular.module('gameApp.gameplay', ['ngRoute'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/gameplay', {
    templateUrl: 'gameplay/gameplay.html',
    controller: 'GameplayController'
  });
}])

.controller('GameplayController', ['$scope', 'CurrentGame', 'Gamecore', function GameplayController($scope, currentGame, gamecore) {

    $scope.socket = window.socket;

    $scope.$on('$locationChangeStart', function( event ) {
        // gamecore.resetGame();
        $scope.socket.send('q');
    });

    $scope.createGameCore = function() {
        // gamecore.resetGame();
        var playerself = gamecore.getPlayerSelf(); // todo remove this stuff
        playerself.userid = currentGame.getUserId();
        playerself.info_color = '#cc0000';
        playerself.state = 'connected';
        playerself.online = true;

        var gameId = currentGame.getGameId();
        if (gameId) {
            $scope.socket.send('j.' + gameId);
        }
    };
}]);

