
'use strict';

angular.module('gameApp').controller('NameController', ['$scope', function NameController($scope) {
    $scope.clientName = 'Anon';
    $scope.playerColor = localStorage.getItem('playerColor') || '#ffffff';
    $scope.playerName = localStorage.getItem('playerName') || 'Anon';
    $scope.changeName = function() {
        localStorage.setItem("playerColor", $scope.playerColor);
        localStorage.setItem("playerName", $scope.playerName);
    };
}]);

