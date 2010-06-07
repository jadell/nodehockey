$("document").ready(function () {
	// Initialize game board
	var hockeytable = $("#hockeytable");
	var gameclient = new GameClient(hockeytable);
});

/**
 * Returns a new game client
 *
 * @param hockeytable    a JQuery object wrapped around a canvas element
 * @return GameClient object
 */
var GameClient = function (hockeytable) {
	var initialstate = initialize();
	var board = new GameBoard(hockeytable, initialstate);
	board.setEntities(initialstate)
		.renderBoard();

	// Attach mousemove event to game board
	hockeytable.mousemove(function (e) {
		var x = e.pageX - this.offsetLeft;
		var y = e.pageY - this.offsetTop;
		player = {
			x : x,
			y : y
		}
		sendToServer(player);
	});

	// Return client
	
	/**
	 * Alert server of movement
	 *
	 * @param player    player state (client scaled)
	 */
	function sendToServer(player) {
		// @todo: Add ws stuff; result handled by receiveFromServer
		receiveFromServer(player);
	}
	
	/**
	 * Receive state from server and update client
	 * @todo: Don't pass in the player here; we will get that from the server too
	 */
	function receiveFromServer(player) {
		// @todo: Add ws stuff
		board.setEntities({
			puck : {
				x : 0.5,
				y : 0.5
			}, 
			player : board.scaleToGame(player),
			opponent : {
				x : 0.5,
				y : 0
			}})
			.renderBoard();
	}
	
	/**
	 * Initialize connection
	 *
	 * @return initial game state
	 */
	function initialize() {
		// @todo: Add ws stuff here
		return {
			puck : {
				x : 0.5,
				y : 0.5,
				r : 0.05
			},
			player : {
				x : 0.5,
				y : 1.0,
				r : 0.0667
			},
			opponent : {
				x : 0.5,
				y : 0.0,
				r : 0.0667
			}
		}
	}
}

/**
 * Returns a new GameBoard object
 * Expects all coords and distances in terms of the game, not the client
 *
 * @param hockeytable    a JQuery object wrapped around a canvas element
 * @param state          Initial state of all the game entities
 * @return GameBoard object
 */
var GameBoard = function (hockeytable, state) {
	const fieldColor = "#FFFFFF";
	const puckColor = "#000000";
	const playerColor = "#0000FF";
	const opponentColor = "#FF0000";

	var board = hockeytable.get(0);
	var ctx = board.getContext("2d");
	var width = hockeytable.attr("width");
	var height = hockeytable.attr("height");
	var midX = Math.round(width/2);
	var midY = Math.round(height/2);

	var currState = scaleState(state, scaleToClient);
	var puckRadius = currState.puck.r;
	var paddleRadius = currState.player.r;
	var prevState = {
		puck     : null,
		player   : null,
		opponent : null
	}

	setEntities(currState);

	return {
		renderBoard   : renderBoard,
		scaleToClient : scaleToClient,
		scaleToGame   : scaleToGame,
		scaleState    : scaleState,
		setEntities   : setEntities,
	}

	/**
	 * Sets the game entity positions
	 *
	 * @param state    game state (puck, player and opponent)
	 * @return GameBoard
	 */
	function setEntities(state) {
		state = scaleState(state, scaleToClient);
		prevState = currState;

		currState = {
			puck : normalizePostion({
				oX : 0,
				oY : 0,
				mX : width,
				mY : height
			}, {
				x : state.puck.x,
				y : state.puck.y,
				r : puckRadius
			}),

			player : normalizePostion({
				oX : 0,
				oY : midY,
				mX : width,
				mY : height
			}, {
				x : state.player.x,
				y : state.player.y,
				r : paddleRadius
			}),

			opponent : normalizePostion({
				oX : 0,
				oY : 0,
				mX : width,
				mY : midY
			}, {
				x : state.opponent.x,
				y : state.opponent.y,
				r : state.paddleRadius
			})
		}

		return this;
	}

	/**
	 * Renders the game board
	 *
	 * @param puck       {x:X,y:Y} of origin
	 * @param player     {x:X,y:Y} of origin
	 * @param opponent   {x:X,y:Y} of origin
	 * @return GameBoard
	 */
	function renderBoard() {
		// Clear the previous state
		ctx.beginPath();
		ctx.fillStyle = fieldColor;
		ctx.fillRect(0,0, width,height);
		ctx.closePath();
		
		// Border and mid-field
		ctx.beginPath();
		ctx.strokeRect(0,0, width,height);
		ctx.moveTo(0, midY);
		ctx.lineTo(width, midY);
		ctx.stroke();
		ctx.closePath();

		// Game pieces
		renderPuck();
		renderPaddle(true);
		renderPaddle(false);

		return this;
	}

	/**
	 * Render the puck
	 */
	function renderPuck() {
		ctx.beginPath();
		ctx.fillStyle = puckColor;
		ctx.arc(currState.puck.x,currState.puck.y, puckRadius, radians(0),radians(360));
		ctx.fill();
		ctx.closePath();
	}

	/**
	 * Render a paddle
	 *
	 * @param player     true for player, false for opponent
	 */
	function renderPaddle(player) {
		paddle = (player) ? currState.player : currState.opponent;

		ctx.beginPath();
		ctx.fillStyle = (player) ? playerColor : opponentColor;
		ctx.arc(paddle.x,paddle.y, paddleRadius, radians(0),radians(360));
		ctx.fill();
	}

	/**
	 * Make sure an entity is entirely within the game board
	 * @param bounds       {oX:left bound, oY:topbound, mX:maxX, mY:maxY}
	 * @param entity       {x:X of origin,y:Y of origin,r:radius}
	 * @return {x:X, y:Y} new origin
	 */
	function normalizePostion(bounds, entity) {
		var newX = entity.x;
		var newY = entity.y;

		if (entity.x - entity.r < bounds.oX) {
			newX = bounds.oX + entity.r;
		} else if (entity.x + entity.r > bounds.mX) {
			newX = bounds.mX - entity.r;
		}

		if (entity.y - entity.r < bounds.oY) {
			newY = bounds.oY + entity.r;
		} else if (entity.y + entity.r > bounds.mY) {
			newY = bounds.mY - entity.r;
		}

		return {
			x : newX,
			y : newY
		};
	}

	/**
	 * Convert degrees to radians
	 *
	 * @param degrees
	 * @return radians
	 */
	function radians(degrees) {
		return (Math.PI/180) * degrees;
	}

	/**
	 * Translate game coords to client coords
	 *
	 * @param coord       {x:X, y:Y, r:radius}
	 * @return {x:sX, y:sY, r:sRadius} coord scaled
	 */
	function scaleToClient(coords) {
		scaled = {
			x : Math.round(coords.x * width),
			y : Math.round(coords.y * height),
			r : Math.round(coords.r * width)
		}
		return scaled;
	}

	/**
	 * Translate client coords to game coords
	 *
	 * @param coord       {x:X, y:Y, r:radius}
	 * @return {x:sX, y:sY, r:sRadius} coord scaled
	 */
	function scaleToGame(coords) {
		scaled = {
			x : Math.floor((coords.x / width) * 1000) / 1000,
			y : Math.floor((coords.y / height) * 1000) / 1000,
			r : Math.floor((coords.r / width) * 1000) / 1000
		}
		return scaled;
	}

	/**
	 * Scale state with given scaling function
	 *
	 * @param state     game state
	 * @param scaler    function with which to scale state
	 * @return scaled state
	 */
	function scaleState(state, scaler) {
		return {
			puck     : scaler(state.puck),
			player   : scaler(state.player),
			opponent : scaler(state.opponent)
		}
	}
}
