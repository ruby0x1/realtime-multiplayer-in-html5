
// game_instance
gamePlayer = function(player_instance) {

    this.player_instance = player_instance;

        //Set up initial values for our state information
    this.pos = { x:0, y:0 };
    this.vel = { x:0, y:0 };
    this.size = { x:16, y:16, hx:8, hy:8 };
    this.rot = 0;
    this.state = 'not-connected';
    this.color = 'rgba(255,255,255,0.1)';
    this.info_color = 'rgba(255,255,255,0.1)';
    this.userid = player_instance ? player_instance.userid : '';

        //These are used in moving us around later
    this.old_state = {pos:{x:0,y:0}, vel: {x: 0, y: 0}, rot: 0};
    this.cur_state = {pos:{x:0,y:0}, vel: {x: 0, y: 0}, rot: 0};
    this.state_time = new Date().getTime();

        //Our local history of inputs
    this.inputs = [];

        //The 'host' of a gameInstance gets created with a player instance since
        //the server already knows who they are. If the server starts a gameInstance
        //with only a host, the other player is set up in the 'else' below
    
    this.pos = this.get_random_position();
    return this;
}; //gamePlayer.constructor

gamePlayer.prototype.to_rad = function(deg) { return deg * 0.017453292519943295; };

gamePlayer.prototype.get_random_position = function() {
    return {x: 50, y: 50};
};

gamePlayer.prototype.emit = function(message, value) {
    if (this.player_instance) {
        this.player_instance.emit(message, value);
    }
};

gamePlayer.prototype.send = function(message) {
    if (this.player_instance) {
        console.log("sending to client ", message);
        this.player_instance.send(message);
    }
};


// gamePlayer.prototype.draw = function(){

//     this.gameInstance.ctx.fillStyle = this.color;

//     this.gameInstance.ctx.save();
//     this.gameInstance.ctx.translate(this.pos.x, this.pos.y);

//     this.gameInstance.ctx.rotate(this.rot);

//     this.gameInstance.ctx.translate(-this.size.hx, -this.size.hy);
//     this.gameInstance.ctx.beginPath();
//     this.gameInstance.ctx.moveTo(0, 0);
//     this.gameInstance.ctx.lineTo(1.3 * this.size.x, this.size.hy);
//     this.gameInstance.ctx.lineTo(0, this.size.y);
//     this.gameInstance.ctx.fill();

//         //Draw a rectangle for us
//     //game.ctx.fillRect(-this.size.hx, -this.size.hy, this.size.x, this.size.y);

//     this.gameInstance.ctx.restore();
//         //Draw a status update
//     this.gameInstance.ctx.fillStyle = this.info_color;
//     this.gameInstance.ctx.fillText(this.state, this.pos.x+10, this.pos.y + 4);

// }; //game_player.draw
