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
	var board = new GameBoard(hockeytable);
	var ws = new WebSocket("ws://localhost:8080");
	ws.onmessage = function (evt) {
		var data = evt.data;
		var state = JSON.parse(data);
		board.setEntities(state).renderBoard();
	}
	ws.onclose = function () {
		$('#servermessage').html('Connection closed by server.');
	}

	// Attach mousemove event to game board
	hockeytable.mousemove(function (e) {
		var x = e.pageX - this.offsetLeft;
		var y = e.pageY - this.offsetTop;
		player = {
			x : x,
			y : y
		}
		ws.send(JSON.stringify(board.scaleToGame(player)));
	});
}

/**
 * Returns a new GameBoard object
 * Expects all coords and distances in terms of the game, not the client
 *
 * @param hockeytable    a JQuery object wrapped around a canvas element
 * @return GameBoard object
 */
var GameBoard = function (hockeytable) {
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

	var currState = {
		puck     : null,
		player   : null,
		opponent : null
	}

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
		currState = {
			puck : {
				x : state.puck.x,
				y : state.puck.y,
				r : state.puck.r
			},

			player : {
				x : state.player.x,
				y : state.player.y,
				r : state.player.r
			},

			opponent : {
				x : state.opponent.x,
				y : state.opponent.y,
				r : state.opponent.r
			}
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
		ctx.arc(currState.puck.x,currState.puck.y, currState.puck.r, radians(0),radians(360));
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
		ctx.arc(paddle.x,paddle.y, paddle.r, radians(0),radians(360));
		ctx.fill();
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
		console.log(JSON.stringify(coords));
		console.log(JSON.stringify(scaled));
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
			x : Math.floor((coords.x / height) * 1000) / 1000,
			y : Math.floor((coords.y / height) * 1000) / 1000,
			r : Math.floor((coords.r / height) * 1000) / 1000
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
