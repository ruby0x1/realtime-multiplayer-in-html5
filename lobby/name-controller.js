
'use strict';

angular.module('gameApp').controller('NameController', ['$scope', function NameController($scope) {
    $scope.clientName = 'Anon';

    $scope.changeName = function() {
        console.log(game);
        game.changeName($scope.clientName);
    };
}]);

