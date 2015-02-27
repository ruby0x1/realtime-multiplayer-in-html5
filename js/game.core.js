/*  Copyright (c) 2012 Sven "FuzzYspo0N" Bergström
    
    written by : http://underscorediscovery.com
    written for : http://buildnewgames.com/real-time-multiplayer/
    
    MIT Licensed.
*/

//The main update loop runs on requestAnimationFrame,
//Which falls back to a setTimeout loop on the server
//Code below is from Three.js, and sourced from links below

    // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    // http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

    // requestAnimationFrame polyfill by Erik Möller
    // fixes from Paul Irish and Tino Zijdel

var frame_time = 60/1000; // run the local game at 16ms/ 60hz
if('undefined' != typeof(global)) frame_time = 45; //on server we run at 45ms, 22hz

( function () {

    var lastTime = 0;
    var vendors = [ 'ms', 'moz', 'webkit', 'o' ];

    for ( var x = 0; x < vendors.length && !window.requestAnimationFrame; ++ x ) {
        window.requestAnimationFrame = window[ vendors[ x ] + 'RequestAnimationFrame' ];
        window.cancelAnimationFrame = window[ vendors[ x ] + 'CancelAnimationFrame' ] || window[ vendors[ x ] + 'CancelRequestAnimationFrame' ];
    }

    if ( !window.requestAnimationFrame ) {
        window.requestAnimationFrame = function ( callback, element ) {
            var currTime = Date.now(), timeToCall = Math.max( 0, frame_time - ( currTime - lastTime ) );
            var id = window.setTimeout( function() { callback( currTime + timeToCall ); }, timeToCall );
            lastTime = currTime + timeToCall;
            return id;
        };
    }

    if ( !window.cancelAnimationFrame ) {
        window.cancelAnimationFrame = function ( id ) { clearTimeout( id ); };
    }

}() );

        //Now the main game class. This gets created on
        //both server and client. Server creates one for
        //each game that is hosted, and client creates one
        //for itself to play the game.

/* The game_core class */

    var game_core = function(players) { //game_instance

            //Store a flag if we are the server
        this.isServer = players !== undefined;

            //Used in collision etc.
        this.world = {
            width : 720,
            height : 480
        };

        this.tagSwitch = true;
        this.tagCollision = false;
        this.tagUserid = null;
        this.tagChanged = false;

        // how much drag space has. reduces the ships speed
        this.dampening_amount = 0.02;
        this.max_velocity = 100;
        this.rotation_speed = 0.07;
        //The speed at which the clients move.
        this.playerspeed = 10;
        this.players = players ? players : [];

        if(!this.isServer) {
            
            var gp = new gamePlayer();
            this.players.push(gp);
            this.playerself = gp;

                //Debugging ghosts, to help visualise things
            this.ghosts = {
                    //Our ghost position on the server
                server_pos_self : new gamePlayer(),
                    //The other players server position as we receive it
                server_pos_other : new gamePlayer(),
                    //The other players ghost destination position (the lerp)
                pos_other : new gamePlayer(),
                server_vel_self : new gamePlayer(),
                    //The other players server position as we receive it
                server_vel_other : new gamePlayer(),
                    //The other players ghost destination position (the lerp)
                vel_other : new gamePlayer()
            };

            this.ghosts.pos_other.state = 'dest_pos';

            this.ghosts.pos_other.info_color = 'rgba(255,255,255,0.1)';

            this.ghosts.server_pos_self.info_color = 'rgba(255,255,255,0.2)';
            this.ghosts.server_pos_other.info_color = 'rgba(255,255,255,0.2)';

            this.ghosts.server_pos_self.state = 'server_pos';
            this.ghosts.server_pos_other.state = 'server_pos';

            this.ghosts.server_pos_self.pos = { x:20, y:20 };
            this.ghosts.pos_other.pos = { x:500, y:200 };
            this.ghosts.server_pos_other.pos = { x:500, y:200 };

            this.ghosts.vel_other.state = 'dest_vel';

            this.ghosts.vel_other.info_color = 'rgba(255,255,255,0.1)';

            this.ghosts.server_vel_self.info_color = 'rgba(255,255,255,0.2)';
            this.ghosts.server_vel_other.info_color = 'rgba(255,255,255,0.2)';

            this.ghosts.server_vel_self.state = 'server_vel';
            this.ghosts.server_vel_other.state = 'server_vel';

            this.ghosts.server_vel_self.vel = { x:20, y:20 };
            this.ghosts.vel_other.vel = { x:500, y:200 };
            this.ghosts.server_vel_other.vel = { x:500, y:200 };
        }

            //Set up some physics integration values
        this._pdt = 0.0001;                 //The physics update delta time
        this._pdte = new Date().getTime();  //The physics update last delta time
            //A local timer for precision on server and client
        this.local_time = 0.016;            //The local timer
        this._dt = new Date().getTime();    //The local timer delta
        this._dte = new Date().getTime();   //The local timer last frame time

            //Start a physics loop, this is separate to the rendering
            //as this happens at a fixed frequency
        this.create_physics_simulation();

            //Start a fast paced timer for measuring time easier
        this.create_timer();

            //Client specific initialisation
        if(!this.isServer) {
            
                //Create a keyboard handler
            this.keyboard = new THREEx.KeyboardState();

                //Create the default configuration settings
            this.client_create_configuration();

                //A list of recent server updates we interpolate across
                //This is the buffer that is the driving factor for our networking
            this.server_updates = [];

                //Connect to the socket.io server!
            this.client_connect_to_server();

                //We start pinging the server to determine latency
            this.client_create_ping_timer();

                //Set their colors from the storage or locally
            this.color = this.getRandomColor();//localStorage.getItem('color') || '#cc8822' ;
            //localStorage.setItem('color', this.color);
            this.playerself.color = this.color;

                //Make this only if requested
            if(String(window.location).indexOf('debug') != -1) {
                this.client_create_debug_gui();
            }

        } else { //if !server

            this.server_time = 0;
            this.laststate = {};

        }

    }; //game_core.constructor

//server side we set the 'game_core' class to a global type, so that it can use it anywhere.
if( 'undefined' != typeof global ) {
    module.exports = global.game_core = game_core;
}

/*
    Helper functions for the game code

        Here we have some common maths and game related code to make working with 2d vectors easy,
        as well as some helpers for rounding numbers to fixed point.

*/

    // (4.22208334636).fixed(n) will return fixed point value to n places, default n = 3
Number.prototype.fixed = function(n) { n = n || 3; return parseFloat(this.toFixed(n)); };
    //copies a 2d vector like object from one to another
game_core.prototype.pos = function(a) { return {x:a.x,y:a.y}; };
    //copies a 2d vector like object from one to another
game_core.prototype.vel = function(a) { return {x:a.x,y:a.y}; };
    //Add a 2d vector with another one and return the resulting vector
game_core.prototype.v_add = function(a,b) { return { x:(a.x+b.x).fixed(), y:(a.y+b.y).fixed() }; };
    //Subtract a 2d vector with another one and return the resulting vector
game_core.prototype.v_sub = function(a,b) { return { x:(a.x-b.x).fixed(),y:(a.y-b.y).fixed() }; };
    //Multiply a 2d vector with a scalar value and return the resulting vector
game_core.prototype.v_mul_scalar = function(a,b) { return {x: (a.x*b).fixed() , y:(a.y*b).fixed() }; };
    //For the server, we need to cancel the setTimeout that the polyfill creates
game_core.prototype.stop_update = function() {  window.cancelAnimationFrame( this.updateid );  };
    //Simple linear interpolation
game_core.prototype.lerp = function(p, n, t) { var _t = Number(t); _t = (Math.max(0, Math.min(1, _t))).fixed(); return (p + _t * (n - p)).fixed(); };
    //Simple linear interpolation between 2 vectors
game_core.prototype.v_lerp = function(v,tv,t) { return { x: this.lerp(v.x, tv.x, t), y:this.lerp(v.y, tv.y, t) }; };
    
game_core.prototype.randomInRange = function(min, max) {
    return Math.random() * (max - min) + min;
};

game_core.prototype.getRandomPostion = function() {
    return {
        x: Math.random() * this.world.width,
        y: Math.random() * this.world.height
    };
};
/*
    The player class

        A simple class to maintain state of a player on screen,
        as well as to draw that state when required.
*/
  

/*

 Common functions
 
    These functions are shared between client and server, and are generic
    for the game state. The client functions are client_* and server functions
    are server_* so these have no prefix.

*/

    //Main update loop
game_core.prototype.update = function(t) {
    
        //Work out the delta time
    this.dt = this.lastframetime ? ( (t - this.lastframetime)/1000.0).fixed() : 0.016;

        //Store the last frame time
    this.lastframetime = t;

        //Update the game specifics
    if(!this.isServer) {
        this.client_update();
    } else {
        this.server_update();
    }

        //schedule the next update
    this.updateid = window.requestAnimationFrame( this.update.bind(this), this.viewport );

}; //game_core.update

game_core.prototype.intializeGame = function () {
    for (var i = 0; i < this.players.length; i++) {
        var player = this.players[i];
        var npos = this.getRandomPostion();
        console.log('npos =', npos);
        player.pos = this.pos(npos);
    }
    this.tagUserid = this.players[0].userid;
    this.tagChanged = true;
    this.server_update();
};

/*
    Shared between server and client.
    In this example, `item` is always of type gamePlayer.
*/
game_core.prototype.check_boundry_collision = function(gamePlayer) {

     var pos_limits = {
        x_min: gamePlayer.size.hx,
        x_max: this.world.width - gamePlayer.size.hx,
        y_min: gamePlayer.size.hy,
        y_max: this.world.height - gamePlayer.size.hy
    };

        //Left wall.
    if(gamePlayer.pos.x <= pos_limits.x_min) {
        gamePlayer.pos.x = pos_limits.x_min;
    }

        //Right wall
    if(gamePlayer.pos.x >= pos_limits.x_max ) {
        gamePlayer.pos.x = pos_limits.x_max;
    }
    
        //Roof wall.
    if(gamePlayer.pos.y <= pos_limits.y_min) {
        gamePlayer.pos.y = pos_limits.y_min;
    }

        //Floor wall
    if(gamePlayer.pos.y >= pos_limits.y_max ) {
        gamePlayer.pos.y = pos_limits.y_max;
    }

        //Fixed point helps be more deterministic
    gamePlayer.pos.x = gamePlayer.pos.x.fixed(4);
    gamePlayer.pos.y = gamePlayer.pos.y.fixed(4);
    
};


game_core.prototype.process_input = function( player ) {

    //It's possible to have recieved multiple inputs by now,
    //so we process each one
    var x_dir = 0;
    var y_dir = 0;
    var ic = player.inputs.length;
    if(ic) {
        for(var j = 0; j < ic; ++j) {
                //don't process ones we already have simulated locally
            if(player.inputs[j].seq <= player.last_input_seq) continue;

            var input = player.inputs[j].inputs;
            var c = input.length;
            for(var i = 0; i < c; ++i) {
                var key = input[i];
                if(key == 'l') {
                    x_dir -= 1;
                }
                if(key == 'r') {
                    x_dir += 1;
                }
                if(key == 'd') {
                    y_dir += 1;
                }
                if(key == 'u') {
                    y_dir -= 1;
                }
            } //for all input values

        } //for each input command
    } //if we have inputs

        //we have a direction vector now, so apply the same physics as the client
    var resulting_vector = {
        x: x_dir,
        y: y_dir
    };
    if(player.inputs.length) {
        //we can now clear the array since these have been processed

        player.last_input_time = player.inputs[ic-1].time;
        player.last_input_seq = player.inputs[ic-1].seq;
    }

        //give it back
    return resulting_vector;

};

game_core.prototype.physics_movement_vector_from_direction = function(direction) {

    //Must be fixed step, at physics sync speed.
    return {
        x : (direction.x * (this.playerspeed * 0.015)).fixed(3),
        y : (direction.y * (this.playerspeed * 0.015)).fixed(3)
    };

};

game_core.prototype.update_physics = function() {

    if(this.isServer) {
        this.server_update_physics();
    } else {
        this.client_update_physics();
    }

};

/*

 Server side functions
 
    These functions below are specific to the server side only,
    and usually start with server_* to make things clearer.

*/

    //Updated at 15ms , simulates the world state
game_core.prototype.server_update_physics = function() {

    this.tagCollision = false;
    var newTagUserid;

    for (var i = 0; i < this.players.length; i++) {
        this.players[i] = this.updatePlayerPhysics(this.players[i]);
        this.check_boundry_collision(this.players[i]);

        for (var j = (i + 1); j < this.players.length; j++) {
            if (this.isColliding(this.players[i], this.players[j])) {
                //console.log("players are colliding");
                if (this.players[i].userid === this.tagUserid || this.players[j].userid === this.tagUserid) {
                    this.tagCollision = true;
                    //console.log("tag player colliding");
                    newTagUserid = this.players[i].userid === this.tagUserid ? this.players[j].userid : this.players[i].userid;
                }
            }
        }

        this.players[i].inputs = []; //we have cleared the input buffer, so remove this
    }

    if (!this.tagSwitch && this.tagCollision) {
        this.tagSwitch = true;
        // onCollide
        console.log("onCollide, new tag user is ", newTagUserid);
        this.tagUserid = newTagUserid;
        this.tagChanged = true;
    }
    if (this.tagSwitch && !this.tagCollision) {
        this.tagSwitch = false;
        // onCollideStop
    }

};

// todo optomize
game_core.prototype.isColliding = function(a, b) {
    var circle1 = {x: a.pos.x, y: a.pos.y, radius: (a.size.x * 0.5)};
    var circle2 = {x: b.pos.x, y: b.pos.y, radius: (b.size.x * 0.5)};
    var dx = (circle1.x + circle1.radius) - (circle2.x + circle2.radius);
    var dy = (circle1.y + circle1.radius) - (circle2.y + circle2.radius);
    var distance = Math.sqrt(dx * dx + dy * dy);
    return (distance < circle1.radius + circle2.radius);
};

game_core.prototype.updatePlayerPhysics = function(player) {
    player.old_state.pos = player.pos;
    player.old_state.vel = player.vel;
    var new_dir = this.process_input(player);
    player.old_state.rot = player.rot;
    player.rot = player.rot + (new_dir.x * this.rotation_speed);
    var new_vel = this.input_to_vec(new_dir, player.rot);
    //var new_vel = this.physics_movement_vector_from_direction(new_dir);
    player.vel = this.v_add(player.old_state.vel, new_vel);
    player.vel = this.dampen_velocity(player.vel);
    player.vel = this.limit_velocity(player.vel);
    player.pos = this.v_add(player.vel, player.old_state.pos);
    return player;
};

game_core.prototype.input_to_vec = function(input, rot) {
    var new_vel = {x: 0, y: 0};
    var rot_vec = this.rot_to_vec(rot);
    rot_vec.x = (input.y == 0 ? 0 : rot_vec.x * 0.1).fixed(4);
    rot_vec.y = (input.y == 0 ? 0 : rot_vec.y * 0.1).fixed(4);
    return rot_vec;
};

game_core.prototype.rot_to_vec = function(rot) {
    return {
        x: Math.cos(rot).fixed(4),
        y: Math.sin(rot).fixed(4)
    };
};

game_core.prototype.limit_velocity = function(vec) {
    var min = -this.max_velocity;
    var max = this.max_velocity;
    var clampedx = Math.min(Math.max(vec.x, min), max);
    var clampedy = Math.min(Math.max(vec.y, min), max);
    return {
        x: clampedx,
        y: clampedy
    };
};


    //Makes sure things run smoothly and notifies clients of changes
    //on the server side
game_core.prototype.server_update = function(){

        //Update the state of our local clock to match the timer
    this.server_time = this.local_time;

        //Make a snapshot of the current state, for updating the clients
    this.laststate = {
        t   : this.server_time, // our current local time on the server
        players : []
    };

    //if (this.tagChanged) {
        this.laststate.tagUserid = this.tagUserid;
        //this.tagChanged = false;
    //}

    // todo only add the values that change!
    for (var i = 0; i < this.players.length; i++) {
        var cp = this.players[i];
        var pdata = {
            userid: cp.userid,
            pos: cp.pos,
            vel: cp.vel,
            rot: cp.rot,
            last_input_seq: cp.last_input_seq
        };
        this.laststate.players.push(pdata);
    }

    for (var i = 0; i < this.players.length; i++) {
        this.players[i].emit('onserverupdate', this.laststate);
    }

}; //game_core.server_update


game_core.prototype.handle_server_input = function(client, input, input_time, input_seq) {
    var player = this.get_player(this.players, client.userid);
    player.inputs.push({inputs:input, time:input_time, seq:input_seq});
};


/*

 Client side functions

    These functions below are specific to the client side only,
    and usually start with client_* to make things clearer.

*/

game_core.prototype.client_handle_input = function(){

    //if(this.lit > this.local_time) return;
    //this.lit = this.local_time+0.5; //one second delay

        //This takes input from the client and keeps a record,
        //It also sends the input information to the server immediately
        //as it is pressed. It also tags each input with a sequence number.

    var x_dir = 0;
    var y_dir = 0;
    var input = [];
    this.client_has_input = false;

    if( this.keyboard.pressed('A') ||
        this.keyboard.pressed('left')) {

            x_dir = -1;
            input.push('l');

        } //left

    if( this.keyboard.pressed('D') ||
        this.keyboard.pressed('right')) {

            x_dir = 1;
            input.push('r');

        } //right

    if( this.keyboard.pressed('S') ||
        this.keyboard.pressed('down')) {

            y_dir = 1;
            input.push('d');

        } //down

    if( this.keyboard.pressed('W') ||
        this.keyboard.pressed('up')) {

            y_dir = -1;
            input.push('u');

        } //up

    if(input.length) {

            //Update what sequence we are on now
        this.input_seq += 1;

            //Store the input state as a snapshot of what happened.

        this.playerself.inputs.push({
            inputs : input,
            time : this.local_time.fixed(3),
            seq : this.input_seq
        });

            //Send the packet of information to the server.
            //The input packets are labelled with an 'i' in front.
        var server_packet = 'i.';
            server_packet += input.join('-') + '.';
            server_packet += this.local_time.toFixed(3).replace('.','-') + '.';
            server_packet += this.input_seq;

            //Go
        this.socket.send(  server_packet  );

            //Return the direction if needed
        return this.physics_movement_vector_from_direction( {x: x_dir, y: y_dir} );

    } else {

        return {x:0,y:0};

    }

}; //game_core.client_handle_input

game_core.prototype.client_process_net_prediction_correction = function() {

        //No updates...
    if(!this.server_updates.length) return;

        //The most recent server update
    var latest_server_data = this.server_updates[this.server_updates.length-1];

    var my_server_pos;
    var my_server_vel;
    var my_server_rot;
    var my_server_last_input_seq;

    for (var i = 0; i < latest_server_data.players.length; i++) {
        var player = latest_server_data.players[i];
        if (player.userid === this.playerself.userid) {
            my_server_pos = player.pos;
            my_server_vel = player.vel;
            my_server_rot = player.rot;
            my_server_last_input_seq = player.last_input_seq;
        }
    }

        //Update the debug server position block
    // this.ghosts.server_pos_self.pos = this.pos(my_server_pos);
    // this.ghosts.server_pos_self.vel = this.vel(my_server_vel);


            //here we handle our local input prediction ,
            //by correcting it with the server and reconciling its differences

        if(my_server_last_input_seq) {
                //The last input sequence index in my local input list
            var lastinputseq_index = -1;
                //Find this input in the list, and store the index
            for(var i = 0; i < this.playerself.inputs.length; ++i) {
                if(this.playerself.inputs[i].seq == my_server_last_input_seq) { // dunno about this
                    lastinputseq_index = i;
                    break;
                }
            }

                //Now we can crop the list of any updates we have already processed
            if(lastinputseq_index != -1) {
                //so we have now gotten an acknowledgement from the server that our inputs here have been accepted
                //and that we can predict from this known position instead

                    //remove the rest of the inputs we have confirmed on the server
                var number_to_clear = Math.abs(lastinputseq_index - (-1));
                this.playerself.inputs.splice(0, number_to_clear);
                    //The player is now located at the new server position, authoritive server
                this.playerself.cur_state.pos = this.pos(my_server_pos);
                this.playerself.cur_state.vel = this.vel(my_server_vel);
                this.playerself.cur_state.rot = my_server_rot;
                this.playerself.last_input_seq = lastinputseq_index;
                    //Now we reapply all the inputs that we have locally that
                    //the server hasn't yet confirmed. This will 'keep' our position the same,
                    //but also confirm the server position at the same time.
                this.client_update_physics();
                this.client_update_local_position();

            } // if(lastinputseq_index != -1)
        } //if my_last_input_on_server

}; //game_core.client_process_net_prediction_correction

game_core.prototype.client_process_net_updates = function() {

        //No updates...
    if(!this.server_updates.length) return;

    //First : Find the position in the updates, on the timeline
    //We call this current_time, then we find the past_pos and the target_pos using this,
    //searching throught the server_updates array for current_time in between 2 other times.
    // Then :  other player position = lerp ( past_pos, target_pos, current_time );

        //Find the position in the timeline of updates we stored.
    var current_time = this.client_time;
    var count = this.server_updates.length-1;
    var target = null;
    var previous = null;

        //We look from the 'oldest' updates, since the newest ones
        //are at the end (list.length-1 for example). This will be expensive
        //only when our time is not found on the timeline, since it will run all
        //samples. Usually this iterates very little before breaking out with a target.
    for(var i = 0; i < count; ++i) {

        var point = this.server_updates[i];
        var next_point = this.server_updates[i+1];

            //Compare our point in time with the server times we have
        if(current_time > point.t && current_time < next_point.t) {
            target = next_point;
            previous = point;
            break;
        }
    }

        //With no target we store the last known
        //server position and move to that instead
    if(!target) {
        target = this.server_updates[0];
        previous = this.server_updates[0];
    }

        //Now that we have a target and a previous destination,
        //We can interpolate between then based on 'how far in between' we are.
        //This is simple percentage maths, value/target = [0,1] range of numbers.
        //lerp requires the 0,1 value to lerp to? thats the one.

    if(target && previous) {

        this.target_time = target.t;

        var difference = this.target_time - current_time;
        var max_difference = (target.t - previous.t).fixed(3);
        var time_point = (difference/max_difference).fixed(3);

            //Because we use the same target and previous in extreme cases
            //It is possible to get incorrect values due to division by 0 difference
            //and such. This is a safe guard and should probably not be here. lol.
        if( isNaN(time_point) ) time_point = 0;
        if(time_point == -Infinity) time_point = 0;
        if(time_point == Infinity) time_point = 0;

            //The most recent server update
        var latest_server_data = this.server_updates[ this.server_updates.length-1 ];

        for (var i = 0; i < latest_server_data.players.length; i++) {
            // set pos
            var other_player_server_data = latest_server_data.players[i];
            var other_player = this.get_player(this.players, other_player_server_data.userid);

            // if not self
            if (other_player && other_player.userid !== this.playerself.userid) {
                if(this.client_smoothing) {
                    var targetplayer = this.get_player(target.players, other_player.userid);
                    var previousplayer = this.get_player(previous.players, other_player.userid);
                    if (targetplayer && previousplayer) {
                        this.smooth_player(this.players, other_player_server_data, targetplayer, previousplayer, time_point);
                    }
                } else {
                    other_player.pos = this.pos(other_player_server_data.pos);
                    other_player.vel = this.vel(other_player_server_data.vel);
                    other_player.rot = other_player_server_data.rot;
                }

            }
            // don't smooth self here
            
        }

        //if(latest_server_data.tagUserid) {
            //console.log("received new tag id form server", latest_server_data.tagUserid);
            this.tagUserid = latest_server_data.tagUserid;
        //}

            //Now, if not predicting client movement , we will maintain the local player position
            //using the same method, smoothing the players information from the past.
        if(!this.client_predict && !this.naive_approach) {
            //this.smooth_player(this.players, this.playerself, target, previous, time_point); //todo re-enable
        }

    } //if target && previous

}; //game_core.client_process_net_updates

// todo make it per property
game_core.prototype.smooth_player = function(players, pdata, target, previous, time_point) {

    var serverpos = pdata.pos;
    var servervel = pdata.vel;
    var serverrot = pdata.rot;
    
    var targetpos = target.pos;
    var targetvel = target.vel;
    var targetrot = target.rot;

    var pastpos = previous.pos;
    var pastvel = previous.vel;
    var pastrot = previous.rot;

    var server_lerp_pos = pastpos ? this.v_lerp(pastpos, targetpos, time_point) : targetpos;
    var server_lerp_vel = pastvel ? this.v_lerp(pastvel, targetvel, time_point) : targetvel;
    var server_lerp_rot = targetrot;

    var player = this.get_player(this.players, pdata.userid);

    player.pos = this.v_lerp(player.pos, server_lerp_pos, this._pdt * this.client_smooth);
    player.vel = this.v_lerp(player.vel, server_lerp_vel, this._pdt * this.client_smooth);
    player.rot = server_lerp_rot;

};

game_core.prototype.get_player = function(players, userid) {
    for (var i = 0; i < players.length; i++) {
        if (players[i].userid === userid) {
            return players[i];
        }
    }
};

game_core.prototype.client_onserverupdate_recieved = function(data){
        
            //Store the server time (this is offset by the latency in the network, by the time we get it)
        this.server_time = data.t;
            //Update our local offset time from the last server update
        this.client_time = this.server_time - (this.net_offset/1000);

            //One approach is to set the position directly as the server tells you.
            //This is a common mistake and causes somewhat playable results on a local LAN, for example,
            //but causes terrible lag when any ping/latency is introduced. The player can not deduce any
            //information to interpolate with so it misses positions, and packet loss destroys this approach
            //even more so. See 'the bouncing ball problem' on Wikipedia.

        if(this.naive_approach) {
            for (var i = 0; i < data.players.length; i++) {
                var serverplayer = data.players[i];
                var player = this.get_player(this.players, serverplayer.userid);
                if (serverplayer.pos) {
                    player.pos = this.pos(serverplayer.pos);
                }
                if (serverplayer.vel) {
                    player.vel = this.vel(serverplayer.vel);
                }
                if (serverplayer.rot) {
                    player.rot = serverplayer.rot;
                }
            }
        } else {

                //Cache the data from the server,
                //and then play the timeline
                //back to the player with a small delay (net_offset), allowing
                //interpolation between the points.
            this.server_updates.push(data);

                //we limit the buffer in seconds worth of updates
                //60fps*buffer seconds = number of samples
            if(this.server_updates.length >= ( 60*this.buffer_size )) {
                this.server_updates.splice(0,1);
            }

                //We can see when the last tick we know of happened.
                //If client_time gets behind this due to latency, a snap occurs
                //to the last tick. Unavoidable, and a reallly bad connection here.
                //If that happens it might be best to drop the game after a period of time.
            this.oldest_tick = this.server_updates[0].t;

                //Handle the latest positions from the server
                //and make sure to correct our local predictions, making the server have final say.
            this.client_process_net_prediction_correction();
            
        } //non naive

}; //game_core.client_onserverupdate_recieved

game_core.prototype.client_update_local_position = function(){

    if(this.client_predict) {

            //Work out the time we have since we updated the state
        var t = (this.local_time - this.playerself.state_time) / this._pdt;

            //Then store the states for clarity,
        //var old_state = this.players.self.old_state.pos;
        var current_state_pos = this.playerself.cur_state.pos;
        var current_state_vel = this.playerself.cur_state.vel;
        var current_state_rot = this.playerself.cur_state.rot;

            //Make sure the visual position matches the states we have stored
        // this.playerself.pos = this.v_add( old_state, this.v_mul_scalar( this.v_sub(current_state,old_state), t )  );
        this.playerself.pos = current_state_pos;
        this.playerself.vel = current_state_vel;
        this.playerself.rot = current_state_rot;
        
            //We handle collision on client if predicting.
        this.check_boundry_collision( this.playerself );
    }  //if(this.client_predict)
}; //game_core.prototype.client_update_local_position

game_core.prototype.client_update_physics = function() {

        //Fetch the new direction from the input buffer,
        //and apply it to the state so we can smooth it in the visual state

    if(this.client_predict) {

        this.playerself.old_state.pos = this.pos( this.playerself.cur_state.pos );
        this.playerself.old_state.vel = this.vel( this.playerself.cur_state.vel );
        this.playerself.old_state.rot = this.playerself.cur_state.rot;
        

        var new_dir = this.process_input(this.playerself);
        var new_vel = this.input_to_vec(new_dir, this.playerself.cur_state.rot);

        this.playerself.cur_state.rot = this.playerself.cur_state.rot + (new_dir.x * this.rotation_speed);
        this.playerself.cur_state.vel = this.v_add( this.playerself.old_state.vel, new_vel);
        this.playerself.cur_state.vel = this.dampen_velocity(this.playerself.cur_state.vel);
        this.playerself.cur_state.vel = this.limit_velocity(this.playerself.cur_state.vel);
        this.playerself.cur_state.pos = this.v_add( this.playerself.old_state.pos, this.playerself.cur_state.vel);
        this.playerself.state_time = this.local_time;
    }

}; //game_core.client_update_physics

game_core.prototype.dampen_velocity = function(vec) {
    return {
        x : (vec.x + (-this.dampening_amount * vec.x)).fixed(4),
        y : (vec.y + (-this.dampening_amount * vec.y)).fixed(4)
    };
};

game_core.prototype.client_update = function() {

        //Clear the screen area
    this.ctx.clearRect(0,0,720,480);

        //draw help/information if required
    this.client_draw_info();

        //Capture inputs from the player
    this.client_handle_input();

        //Network player just gets drawn normally, with interpolation from
        //the server updates, smoothing out the positions from the past.
        //Note that if we don't have prediction enabled - this will also
        //update the actual local client position on screen as well.
    if( !this.naive_approach ) {
        this.client_process_net_updates();
    }
        //When we are doing client side prediction, we smooth out our position
        //across frames using local input states we have stored.
    this.client_update_local_position();

    //Now they should have updated, we can draw the entity
    for (var i = 0; i < this.players.length; i++) {
        this.drawPlayer(this.players[i]);
    }

        //and these
    if(this.show_dest_pos && !this.naive_approach) {
        //this.ghosts.pos_other.draw();
    }

        //and lastly draw these
    if(this.show_server_pos && !this.naive_approach) {
        // this.ghosts.server_pos_self.draw();
        // this.ghosts.server_pos_other.draw();
    }

        //Work out the fps average
    this.client_refresh_fps();

}; //game_core.update_client

game_core.prototype.create_timer = function(){
    setInterval(function(){
        this._dt = new Date().getTime() - this._dte;
        this._dte = new Date().getTime();
        this.local_time += this._dt/1000.0;
    }.bind(this), 4);
}

game_core.prototype.create_physics_simulation = function() {

    setInterval(function(){
        this._pdt = (new Date().getTime() - this._pdte)/1000.0;
        this._pdte = new Date().getTime();
        this.update_physics();
    }.bind(this), 15);

}; //game_core.client_create_physics_simulation


game_core.prototype.client_create_ping_timer = function() {

        //Set a ping timer to 1 second, to maintain the ping/latency between
        //client and server and calculated roughly how our connection is doing

    setInterval(function(){

        this.last_ping_time = new Date().getTime() - this.fake_lag;
        this.socket.send('p.' + (this.last_ping_time) );

    }.bind(this), 1000);
    
}; //game_core.client_create_ping_timer


game_core.prototype.client_create_configuration = function() {

    this.show_help = false;             //Whether or not to draw the help text
    this.naive_approach = false;        //Whether or not to use the naive approach
    this.show_server_pos = false;       //Whether or not to show the server position
    this.show_dest_pos = false;         //Whether or not to show the interpolation goal
    this.client_predict = true;         //Whether or not the client is predicting input
    this.input_seq = 0;                 //When predicting client inputs, we store the last input as a sequence number
    this.client_smoothing = true;       //Whether or not the client side prediction tries to smooth things out
    this.client_smooth = 25;            //amount of smoothing to apply to client update dest

    this.net_latency = 0.001;           //the latency between the client and the server (ping/2)
    this.net_ping = 0.001;              //The round trip time from here to the server,and back
    this.last_ping_time = 0.001;        //The time we last sent a ping
    this.fake_lag = 0;                //If we are simulating lag, this applies only to the input client (not others)
    this.fake_lag_time = 0;

    this.net_offset = 100;              //100 ms latency between server and client interpolation for other clients
    this.buffer_size = 2;               //The size of the server history to keep for rewinding/interpolating.
    this.target_time = 0.01;            //the time where we want to be in the server timeline
    this.oldest_tick = 0.01;            //the last time tick we have available in the buffer

    this.client_time = 0.01;            //Our local 'clock' based on server time - client interpolation(net_offset).
    this.server_time = 0.01;            //The time the server reported it was at, last we heard from it
    
    this.dt = 0.016;                    //The time that the last frame took to run
    this.fps = 0;                       //The current instantaneous fps (1/this.dt)
    this.fps_avg_count = 0;             //The number of samples we have taken for fps_avg
    this.fps_avg = 0;                   //The current average fps displayed in the debug UI
    this.fps_avg_acc = 0;               //The accumulation of the last avgcount fps samples

    this.lit = 0;
    this.llt = new Date().getTime();

};//game_core.client_create_configuration

game_core.prototype.client_create_debug_gui = function() {

    this.gui = new dat.GUI();

    var _playersettings = this.gui.addFolder('Your settings');

        this.colorcontrol = _playersettings.addColor(this, 'color');

            //We want to know when we change our color so we can tell
            //the server to tell the other clients for us
        this.colorcontrol.onChange(function(value) {
            this.playerself.color = value;
            localStorage.setItem('color', value);
            this.socket.send('c.' + value);
        }.bind(this));

        _playersettings.open();

    var _othersettings = this.gui.addFolder('Methods');

        _othersettings.add(this, 'naive_approach').listen();
        _othersettings.add(this, 'client_smoothing').listen();
        _othersettings.add(this, 'client_smooth').listen();
        _othersettings.add(this, 'client_predict').listen();

    var _debugsettings = this.gui.addFolder('Debug view');
        
        _debugsettings.add(this, 'show_help').listen();
        _debugsettings.add(this, 'fps_avg').listen();
        _debugsettings.add(this, 'show_server_pos').listen();
        _debugsettings.add(this, 'show_dest_pos').listen();
        _debugsettings.add(this, 'local_time').listen();

        _debugsettings.open();

    var _consettings = this.gui.addFolder('Connection');
        _consettings.add(this, 'net_latency').step(0.001).listen();
        _consettings.add(this, 'net_ping').step(0.001).listen();

            //When adding fake lag, we need to tell the server about it.
        var lag_control = _consettings.add(this, 'fake_lag').step(0.001).listen();
        lag_control.onChange(function(value){
            this.socket.send('l.' + value);
        }.bind(this));

        _consettings.open();

    var _netsettings = this.gui.addFolder('Networking');
        
        _netsettings.add(this, 'net_offset').min(0.01).step(0.001).listen();
        _netsettings.add(this, 'server_time').step(0.001).listen();
        _netsettings.add(this, 'client_time').step(0.001).listen();
        //_netsettings.add(this, 'oldest_tick').step(0.001).listen();

        _netsettings.open();

}; //game_core.client_create_debug_gui

game_core.prototype.client_reset_positions = function() {

    console.log("positions have been reset");

    var resetpos = {x: 0, y: 0};
    var resetvel = {x: 0, y: 0};
    var resetrot = 0;

        //Make sure the local player physics is updated
    this.playerself.old_state.pos = this.pos(resetpos);
    this.playerself.pos = this.pos(resetpos);
    this.playerself.cur_state.pos = this.pos(resetpos);

    this.playerself.old_state.vel = this.vel(resetvel);
    this.playerself.vel = this.vel(resetvel);
    this.playerself.cur_state.vel = this.vel(resetvel);

    this.playerself.old_state.rot = resetrot;
    this.playerself.rot = resetrot;
    this.playerself.cur_state.rot = resetrot;

        //Position all debug view items to their owners position
    // this.ghosts.server_pos_self.pos = this.pos(this.playerself.pos);

    // this.ghosts.server_pos_other.pos = this.pos(this.playerself.pos);
    // this.ghosts.pos_other.pos = this.pos(this.players.other.pos);

    // this.ghosts.server_vel_self.vel = this.vel(this.players.self.vel);

    // this.ghosts.server_vel_other.vel = this.vel(this.players.other.vel);
    // this.ghosts.vel_other.vel = this.vel(this.players.other.vel);

}; //game_core.client_reset_positions

game_core.prototype.client_onreadygame = function(data) {

    var server_time = parseFloat(data.replace('-','.'));

    this.local_time = server_time + this.net_latency;
    console.log('server time is about ' + this.local_time);

        //Store their info colors for clarity. server is always blue
    for (var i = 0; i < this.players.length; i++) {
        this.players[i].state = 'local_pos(joined)';
        this.players[i].info_color = '#666666';
    }

    this.playerself.state = 'YOU ' + this.playerself.state;

        //Make sure colors are synced up
    this.socket.send('c.' + this.playerself.color);

}; //client_onreadygame

game_core.prototype.client_onjoingame = function(data) {
    this.playerself.state = 'connected.joined.waiting';
    this.playerself.info_color = '#00bb00';
    this.client_reset_positions();
};

game_core.prototype.client_onhostgame = function(data) {

    //The server sends the time when asking us to host, but it should be a new game.
    //so the value will be really small anyway (15 or 16ms)
    var server_time = parseFloat(data.replace('-','.'));

    //Get an estimate of the current time on the server
    this.local_time = server_time + this.net_latency;

    this.playerself.state = 'waiting for a player';
    this.playerself.info_color = '#cc0000';

    this.client_reset_positions();
};

game_core.prototype.client_onconnected = function(data) {

    //The server responded that we are now in a game,
    //this lets us store the information about ourselves and set the colors
    //to show we are now ready to be playing.
    this.playerself.userid = data.userid;
    this.playerself.info_color = '#cc0000';
    this.playerself.state = 'connected';
    this.playerself.online = true;

};

game_core.prototype.client_on_otherclientcolorchange = function(data, userid) {
    
    var player = this.get_player(this.players, userid);
    if (player) {
        player.color = data;
    } else {
        console.log("no player to update color");
    }
};

game_core.prototype.client_onnamechange = function(data, userid) {
    var player = this.get_player(this.players, userid);
    if (player) {
        player.name = data;
    } else {
        console.log("no player to update name");
    }
};

game_core.prototype.client_onping = function(data) {
    this.net_ping = new Date().getTime() - parseFloat( data );
    this.net_latency = this.net_ping/2;
};

game_core.prototype.client_ontagged = function(data) {
    this.tagUserid = data;
};

game_core.prototype.client_onnetmessage = function(data) {

    var commands = data.split('.');
    var command = commands[0];
    var subcommand = commands[1] || null;
    var commanddata = commands[2] || null;
    var morecommanddata = commands[3] || null;

    switch(command) {
        case 's': //server message

            switch(subcommand) {

                case 'h' : //host a game requested
                    this.client_onhostgame(commanddata); break;

                case 'j' : //join a game requested
                    this.client_onjoingame(commanddata); break;

                case 'r' : //ready a game requested
                    this.client_onreadygame(commanddata); break;

                case 'e' : //end game requested
                    this.client_ondisconnect(commanddata); break;

                case 't' : //end game requested
                    this.client_ontagged(commanddata); break;

                case 'a' : //add player requested
                    this.client_onaddplayer(commanddata, morecommanddata); break;

                case 'p' : //server ping
                    this.client_onping(commanddata); break;

                case 'n' : //server ping
                    this.client_onnamechange(commanddata, morecommanddata); break;

                case 'c' : //other player changed colors
                    this.client_on_otherclientcolorchange(commanddata, morecommanddata); break;

            } //subcommand

        break; //'s'
    } //command
                
}; //client_onnetmessage

game_core.prototype.client_onaddplayer = function(userid, name) {
    var playerHolder = {};
    playerHolder.userid = userid;
    playerHolder.name = name;
    console.log("playerHolder ", playerHolder);
    playerHolder.emit = function() {
        console.log("this shouldn't be called i think, emit");
    };
    playerHolder.send = function() {
        console.log("this shouldn't be called i think, send");
    };
    this.players.push(new gamePlayer(playerHolder));
};

game_core.prototype.client_ondisconnect = function(data) {
    
        //When we disconnect, we don't know if the other player is
        //connected or not, and since we aren't, everything goes to offline

    this.playerself.info_color = 'rgba(255,255,255,0.1)';
    this.playerself.state = 'not-connected';
    this.playerself.online = false;
    this.players = [];
    this.players.push(this.playerself);

    // this.players.other.info_color = 'rgba(255,255,255,0.1)';
    // this.players.other.state = 'not-connected';

}; //client_ondisconnect

game_core.prototype.client_connect_to_server = function() {
        
            //Store a local reference to our connection to the server
        this.socket = io.connect();

            //When we connect, we are not 'connected' until we have a server id
            //and are placed in a game by the server. The server sends us a message for that.
        this.socket.on('connect', function(){
            this.playerself.state = 'connecting';
        }.bind(this));

            //Sent when we are disconnected (network, server down, etc)
        this.socket.on('disconnect', this.client_ondisconnect.bind(this));
            //Sent each tick of the server simulation. This is our authoritive update
        this.socket.on('onserverupdate', this.client_onserverupdate_recieved.bind(this));
            //Handle when we connect to the server, showing state and storing id's.
        this.socket.on('onconnected', this.client_onconnected.bind(this));
            //On error we just show that we are not connected for now. Can print the data.
        this.socket.on('error', this.client_ondisconnect.bind(this));
            //On message from the server, we parse the commands and send it to the handlers
        this.socket.on('message', this.client_onnetmessage.bind(this));

}; //game_core.client_connect_to_server


game_core.prototype.client_refresh_fps = function() {

        //We store the fps for 10 frames, by adding it to this accumulator
    this.fps = 1/this.dt;
    this.fps_avg_acc += this.fps;
    this.fps_avg_count++;

        //When we reach 10 frames we work out the average fps
    if(this.fps_avg_count >= 10) {

        this.fps_avg = this.fps_avg_acc/10;
        this.fps_avg_count = 1;
        this.fps_avg_acc = this.fps;

    } //reached 10 frames

}; //game_core.client_refresh_fps

game_core.prototype.changeName = function(name) {
    this.socket.send('n.' + name);
};

game_core.prototype.drawPlayer = function(player){

    if (this.ctx) {
        this.ctx.fillStyle = player.color;
        if (player.userid === this.tagUserid) {
            this.ctx.fillStyle = '#ff2222';
        }

        this.ctx.save();
        this.ctx.translate(player.pos.x, player.pos.y);

        this.ctx.rotate(player.rot);

        this.ctx.translate(-player.size.hx, -player.size.hy);
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(1.3 * player.size.x, player.size.hy);
        this.ctx.lineTo(0, player.size.y);
        this.ctx.fill();

            //Draw a rectangle for us
        //game.ctx.fillRect(-this.size.hx, -this.size.hy, this.size.x, this.size.y);

        this.ctx.restore();
            //Draw a status update
        if (player.state !== 'local_pos(joined)' && player.state !== 'YOU local_pos(joined)') {
            this.ctx.fillStyle = player.info_color;
            this.ctx.fillText(player.state, player.pos.x+18, player.pos.y + 4);
        }

        this.ctx.fillStyle = player.color;
        this.ctx.fillText(player.name, player.pos.x-14, player.pos.y + 24);
    }
};

game_core.prototype.client_draw_info = function() {

        //We don't want this to be too distracting
    this.ctx.fillStyle = 'rgba(255,255,255,0.3)';

        //They can hide the help with the debug GUI
    if(this.show_help) {

        this.ctx.fillText('net_offset : local offset of others players and their server updates. Players are net_offset "in the past" so we can smoothly draw them interpolated.', 10 , 30);
        this.ctx.fillText('server_time : last known game time on server', 10 , 70);
        this.ctx.fillText('client_time : delayed game time on client for other players only (includes the net_offset)', 10 , 90);
        this.ctx.fillText('net_latency : Time from you to the server. ', 10 , 130);
        this.ctx.fillText('net_ping : Time from you to the server and back. ', 10 , 150);
        this.ctx.fillText('fake_lag : Add fake ping/lag for testing, applies only to your inputs (watch server_pos block!). ', 10 , 170);
        this.ctx.fillText('client_smoothing/client_smooth : When updating players information from the server, it can smooth them out.', 10 , 210);
        this.ctx.fillText(' This only applies to other clients when prediction is enabled, and applies to local player with no prediction.', 170 , 230);

    } //if this.show_help

        //Reset the style back to full white.
    this.ctx.fillStyle = 'rgba(255,255,255,1)';

}; //game_core.client_draw_help

game_core.prototype.getRandomColor = function() {
    return '#'+Math.floor((Math.random()*8388607 ) + 8388607 ).toString(16);
}; 
