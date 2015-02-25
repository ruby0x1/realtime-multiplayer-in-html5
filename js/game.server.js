/*  Copyright (c) 2012 Sven "FuzzYspo0N" Bergström
    
    written by : http://underscorediscovery.com
    written for : http://buildnewgames.com/real-time-multiplayer/
    
    MIT Licensed.
*/

    var game_server = module.exports = { games : {}, game_count:0 };
    var UUID        = require('node-uuid');
    var verbose     = true;

    //Since we are sharing code with the browser, we
    //are going to include some values to handle that.
    global.window = global.document = global;

    //Import shared game library code.
    require('./gamePlayer.js');
    require('./game.core.js');

    //A simple wrapper for logging so we can toggle it,
    //and augment it for clarity.
    game_server.log = function() {
        if (verbose) console.log.apply(this,arguments);
    };

    game_server.fake_latency = 0;
    game_server.local_time = 0;
    game_server._dt = new Date().getTime();
    game_server._dte = new Date().getTime();
        //a local queue of messages we delay if faking latency
    game_server.messages = [];
    game_server.num_players = 2;

    setInterval(function() {
        game_server._dt = new Date().getTime() - game_server._dte;
        game_server._dte = new Date().getTime();
        game_server.local_time += game_server._dt/1000.0;
    }, 4);

    // cover used to fake latency by using a queue and delay
    game_server.onMessage = function(client,message) {

        if (this.fake_latency && message.split('.')[0].substr(0,1) == 'i') {

                //store all input message
            game_server.messages.push({client:client, message:message});

            setTimeout(function() {
                if (game_server.messages.length) {
                    game_server._onMessage( game_server.messages[0].client, game_server.messages[0].message );
                    game_server.messages.splice(0,1);
                }
            }.bind(this), this.fake_latency);

        } else {
            game_server._onMessage(client, message);
        }
    };
    
    game_server._onMessage = function(client, message) {

            //Cut the message up into sub components
        var message_parts = message.split('.');
            //The first is always the type of message
        var message_type = message_parts[0];

        if(message_type == 'i') {
                //Input handler will forward this
            this.onInput(client, message_parts);
        } else if(message_type == 'p') {
            client.send('s.p.' + message_parts[1]);
        } else if(message_type == 'c') {    //Client changed their color!
            this.broadcast(client, message_parts[1]);
            // if(other_client)
            //     other_client.send('s.c.' + message_parts[1]);
        } else if(message_type == 'l') {    //A client is asking for lag simulation
            this.fake_latency = parseFloat(message_parts[1]);
        }

    }; //game_server.onMessage

    game_server.broadcast = function(client, color) {
        for (var i = 0; i < client.game.players.length; i++) {
            var other_client = client.game.players[i];
            if (other_client.userid !== client.userid) {
                other_client.send('s.c.' + color + '.' + client.userid);
            }
        }
    };

    game_server.onInput = function(client, parts) {
            //The input commands come in like u-l,
            //so we split them up into separate commands,
            //and then update the players
        var input_commands = parts[1].split('-');
        var input_time = parts[2].replace('-','.');
        var input_seq = parts[3];

            //the client should be in a game, so
            //we can tell that game to handle the input
        if (client && client.game && client.game.serverGamecore) {
            client.game.serverGamecore.handle_server_input(client, input_commands, input_time, input_seq);
        } else {
            console.log("received input from client but can't handle it ", client.game);
        }

    }; //game_server.onInput

        //Define some required functions
    game_server.createGame = function(client) {


            //Create a new game instance
        
        var gamePlayers = [];


        var player = new gamePlayer(client);
        gamePlayers.push(player);

        var thegame = {
                id : UUID(),                //generate a new id for the game
                player_host: player,         //so we know who initiated the game // player_host
                // player_client: null,
                players: gamePlayers,
                serverGamecore: undefined
            };

        thegame.serverGamecore = new game_core(gamePlayers);
        thegame.serverGamecore.update(new Date().getTime());

        client.game = thegame;

            //Store it in the list of game
        this.games[thegame.id] = thegame;

            //Keep track
        this.game_count++;

            //Create a new game core instance, this actually runs the
            //game code like collisions and such.
         // todo inject interface here
            //Start updating the game loop on the server
        

            //tell the player that they are now the host
            //s=server message, h=you are hosting

        player.send('s.h.'+ String(thegame.serverGamecore.local_time).replace('.','-'));
        console.log('server host at  ' + thegame.serverGamecore.local_time);
        // player.game = thegame;
        // player.hosting = true;
        
        this.log('player ' + player.userid + ' created a game with id ' + thegame.id);

            //return it
        return thegame;

    }; //game_server.createGame

    // notify all the players that the game has started
    game_server.startGame = function(game) {
        console.log("host = ", game.player_host.userid);
        console.log("start, availgame players length ", game.players.length);
        for (var i = 0; i < game.players.length; i++) {
            game.players[i].send('s.r.'+ String(game.serverGamecore.local_time).replace('.','-'));
        }
    }; //game_server.startGame

    game_server.joinOrCreateGame = function(client) {
        this.log('looking for a game. We have : ' + this.game_count + ' games');

        var availableGame = this.findAvailableGame();
        if (availableGame) {
                //increase the player count and store
                //the player as the client of this game
            var p = new gamePlayer(client);
            // availableGame.player_client = p;
            availableGame.players.push(p);
            client.game = availableGame;
            p.send('s.j.' + availableGame.player_host.userid);
            for (var i = 0; i < availableGame.players.length; i++) {
                var existingplayer = availableGame.players[i];
                if (existingplayer.userid !== p.userid) {
                    existingplayer.send('s.a.' + p.userid);
                    p.send('s.a.' + existingplayer.userid);
                }
            }
            

            console.log("join, availgame players length", availableGame.players.length);

                //start running the game on the server,
                //which will tell them to respawn/start
            console.log("availableGame.players.length ", availableGame.players.length);
            console.log("this.num_players ", this.num_players);
            if (availableGame.players.length === this.num_players) {
                this.startGame(availableGame);
            }
        } else {
            // no empty games, so create one and join it
            this.createGame(client);
        }
    }; //game_server.findGame

    game_server.findAvailableGame = function () {
        var foundGame = undefined;
        for(var gameid in this.games) {
                //only care about our own properties.
            if(!this.games.hasOwnProperty(gameid)) continue;
                //get the game we are checking against
            var game_instance = this.games[gameid];
                //If the game is a player short
            if(game_instance.players.length < this.num_players) {
                foundGame = game_instance;
            }
        }
        return foundGame;
    };

    //we are requesting to kill a game in progress.
    game_server.endGame = function(gameid, userid) {

        var thegame = this.games[gameid];

        if(thegame) {

                //stop the game updates immediate
            thegame.serverGamecore.stop_update();

                //if the game has two players, the one is leaving
            // if(thegame.players.length > 1) {

            //         //send the players the message the game is ending
            //     if(userid == thegame.player_host.userid) {

            //             //the host left, oh snap. Lets try join another game

            //         if(thegame.player_client) {
            //                 //tell them the game is over
            //             thegame.player_client.send('s.e');
            //                 //now look for/create a new game.
            //             this.joinOrCreateGame(thegame.player_client);
            //         }
                    
            //     } else {
            //             //the other player left, we were hosting
            //         if(thegame.player_host) {
            //                 //tell the client the game is ended
            //             thegame.player_host.send('s.e');
            //                 //i am no longer hosting, this game is going down
            //             thegame.player_host.host = false;
            //                 //now look for/create a new game.
            //             this.joinOrCreateGame(thegame.player_host);
            //         }
            //     }
            // }

            for (var i = 0; i < thegame.players.length; i++) {
                var player = thegame.players[i];
                player.send('s.e');
                this.joinOrCreateGame(player);
            }

            delete this.games[gameid];
            this.game_count--;

            this.log('game removed. there are now ' + this.game_count + ' games' );

        } else {
            this.log('that game was not found!');
        }

    }; //game_server.endGame


