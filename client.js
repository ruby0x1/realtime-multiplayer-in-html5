		//A global for our game root.
	var game = {};

		//When loading, we store references to our 
		//drawing canvases, and initiate a game instance.
	window.onload = function(){

			//Create our game instance.
		game = new game_core();

				//Fetch the viewports
			game.debugview = document.getElementById('debug-viewport');
			game.viewport = document.getElementById('viewport');
				
				//Adjust their sizes
			game.viewport.width = game.world.width; 
			game.debugview.width = game.world.width; 

			game.viewport.height = game.world.height;
			game.debugview.height = game.world.height;

				//Fetch the rendering contexts
			game.ctx = game.viewport.getContext('2d');
			game.debugctx = game.debugview.getContext('2d');

				//Set the draw style for the font
			game.ctx.font = '11px "Helvetica"';
			game.debugctx.font = '11px "Helvetica"';

			//Finally, start the loop
		game.update( new Date().getTime() );

	}