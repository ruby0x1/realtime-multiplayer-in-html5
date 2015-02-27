var app = angular.module('gameApp', []);

app.controller('NameController', ['$scope', function($scope) {
    $scope.clientName = 'Anon';

    $scope.changeName = function() {
        console.log(game);
        game.changeName($scope.clientName);
    };
}]);

