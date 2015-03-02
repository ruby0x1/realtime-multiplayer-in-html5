'use strict';

angular.module('gameApp').factory('CurrentGame', function () {

    var data = {
        gameId: '',
        userId: ''
    };

    return {
        getGameId: function () {
            return data.gameId;
        },
        setGameId: function (gameId) {
            data.gameId = gameId;
        },
        getUserId: function () {
            return data.userId;
        },
        setUserId: function (userId) {
            data.userId = userId;
        }
    };
});