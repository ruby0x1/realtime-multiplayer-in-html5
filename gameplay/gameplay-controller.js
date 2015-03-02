'use strict';

angular.module('gameApp.gameplay', ['ngRoute'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/gameplay', {
    templateUrl: 'gameplay/gameplay.html',
    controller: 'GameplayController'
  });
}])

.controller('GameplayController', ['$scope', 'CurrentGame', function GameplayController($scope, currentGame) {

    $scope.socket = window.socket;
    $scope.game;

    $scope.createGameCore = function() {
        console.log("core created");
        $scope.game = new game_core($scope.socket);

            //Fetch the viewport
        $scope.game.viewport = document.getElementById('viewport');
            
            //Adjust their size
        $scope.game.viewport.width = $scope.game.world.width;
        $scope.game.viewport.height = $scope.game.world.height;

            //Fetch the rendering contexts
        $scope.game.ctx = $scope.game.viewport.getContext('2d');

            //Set the draw style for the font
        $scope.game.ctx.font = '11px "Helvetica"';

            //Finally, start the loop
        $scope.game.update( new Date().getTime() );
        $scope.game.playerself.userid = currentGame.getUserId();
        $scope.game.playerself.info_color = '#cc0000';
        $scope.game.playerself.state = 'connected';
        $scope.game.playerself.online = true;
        window.game = $scope.game;
        var gameId = currentGame.getGameId();
        if (gameId) {
            $scope.socket.send('j.' + gameId);
        }
    };
}]);

