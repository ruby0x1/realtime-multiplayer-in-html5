'use strict';

angular.module('gameApp.lobby', ['ngRoute'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/lobby', {
    templateUrl: 'lobby/lobby.html',
    controller: 'LobbyController'
  });
}])

.controller('LobbyController', ['$scope', 'CurrentGame', '$location', function LobbyController($scope, currentGame, $location) {

    $scope.socket = window.socket;

    $scope.socket.on('ongamelist', function (message) {
        console.log("callback called");
        $scope.$apply(function() {
            $scope.games = message ? message : [];
        });
    });

    $scope.createGame = function() {
        $scope.socket.send('c');
        console.log("creating a game and auto joining it");
        $location.path('/gameplay');
    };
    $scope.getGamesList = function() {
        $scope.socket.on('onconnected', function(data) {
            console.log("oncennected received! data = ", data.userid);
            $scope.$apply(function() {
                $scope.userid = data.userid;
                currentGame.setUserId(data.userid);
            });
        });
        $scope.socket.send('l');
    };
    $scope.joinGame = function(game) {
        console.log("joining game id to ", game.id);
        currentGame.setGameId(game.id);
        // console.log("current game id is now ", currentGame.getGameId());
        // go to $location gameplay
        $location.path('/gameplay');
    };

    // $scope.joinGame = function() {
    //     // var gameId = currentGame.getGameId();
    //     console.log("joining current game id ", gameId);
    //     $scope.socket.send('g.' + gameId);
    // };
}]);

