
var game_core_server = function(game) {
    this.players = [];
    this.instance = instance;
    var array = this.instance.players;
    for (var i = 0; i < array.length; i++) {
        this.players.push(new game_player(this, array[i]));
    }
};