/**
 * Copyright (c) 2010 Josh Adell <josh.adell@gmail.com>
 *
 * This code is licensed under the MIT License http://www.opensource.org/licenses/mit-license.php
 *
 */
$("document").ready(function () {
	// Initialize game board
	var hockeytable = $("#hockeytable");
	var servermessage = $("#servermessage");
	var gameclient = new GameClient(hockeytable, servermessage);
});

/**
 * Returns a new game client
 *
 * @param hockeytable      a JQuery object wrapped around a canvas element
 * @param servermessage    a JQuery object wrapped around the element in which to display server messages
 * @return GameClient object
 */
var GameClient = function (hockeytable, servermessage) {
	
	var setServerMessage = function (message) {
		servermessage.html(message.replace(/\n/g, '<br />') + '<br />' + servermessage.html());
	}

	var board = null;
	var ws = new WebSocket("ws://localhost:8080");
	ws.onopen = function () {
		hockeytable.mousemove(function (e) {
			var x = e.pageX - this.offsetLeft;
			var y = e.pageY - this.offsetTop;
			player = board.scaleToGame({
				x : x,
				y : y
			});
			ws.send(JSON.stringify(player));
		});
	}
	ws.onmessage = function (evt) {
		var data = JSON.parse(evt.data);

		if (data.type == 'init') {
			board = new GameBoard(hockeytable, data.table);
		} else if (data.type == 'state') {
			board.setEntities(data.state).renderBoard();
		}
		
		if (data.message) {
			setServerMessage(data.message);
		}
	}
	ws.onclose = function () {
		setServerMessage('Connection closed by server.');
	}
}

/**
 * Returns a new GameBoard object
 * Expects all coords and distances in terms of the game, not the client
 *
 * @param hockeytable    a JQuery object wrapped around a canvas element
 * @param inittable      initial table dimensions
 * @return GameBoard object
 */
var GameBoard = function (hockeytable, inittable) {
	const fieldColor = "#FFFFFF";
	const goalColor = "#00FF00";
	const puckColor = "#000000";
	const playerColor = "#0000FF";
	const opponentColor = "#FF0000";

	var board = hockeytable.get(0);
	var ctx = board.getContext("2d");
	
	var tableHeight = inittable.height;
	var tableWidth  = inittable.width;
    var goalWidth   = inittable.goal;
	var tableMidX   = tableWidth/2;
 	var tableMidY   = tableHeight/2;
	var tableRatio  = tableWidth / tableHeight;
	
	var height = 400;
	var width = height * tableRatio;
 	hockeytable.attr("width", width);
	hockeytable.attr("height", height);

	var scaleFactor = height / tableHeight;
	var singlePixel = 1 / scaleFactor;
	ctx.scale(scaleFactor, -scaleFactor);
	ctx.translate(0, -tableHeight);

	var currState = {
		puck     : null,
		player   : null,
		opponent : null
	}

	return {
		renderBoard   : renderBoard,
		scaleToGame   : scaleToGame,
		setEntities   : setEntities,
	}

	/**
	 * Sets the game entity positions
	 *
	 * @param state    game state (puck, player and opponent)
	 * @return GameBoard
	 */
	function setEntities(state) {
		currState = {
			puck : {
				x : state.puck.x,
				y : state.puck.y,
				r : state.puck.r
			},

			player : {
				x : state.player.x,
				y : state.player.y,
				r : state.player.r,
				score : state.player.score
			},

			opponent : {
				x : state.opponent.x,
				y : state.opponent.y,
				r : state.opponent.r,
				score : state.opponent.score
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
		ctx.fillRect(0,0, tableWidth,tableHeight);
		ctx.closePath();
		
		// Border and mid-field
 		ctx.beginPath();
		ctx.lineWidth = singlePixel;
 		ctx.strokeRect(0,0, tableWidth-singlePixel,tableHeight);
		ctx.lineWidth = singlePixel*3;
 		ctx.moveTo(0, tableMidY);
 		ctx.lineTo(tableWidth, tableMidY);
 		ctx.stroke();
 		ctx.closePath();

		// Goals
 		ctx.beginPath();
		ctx.lineWidth = singlePixel;
		ctx.fillStyle = goalColor;
 		ctx.fillRect((tableWidth-goalWidth)/2,0, goalWidth,singlePixel*5);
 		ctx.strokeRect((tableWidth-goalWidth)/2,0, goalWidth,singlePixel*5);
 		ctx.fillRect((tableWidth-goalWidth)/2, tableHeight-(singlePixel*5), goalWidth,singlePixel*5);
 		ctx.strokeRect((tableWidth-goalWidth)/2,tableHeight-(singlePixel*5), goalWidth,singlePixel*5);
 		ctx.closePath();

		// Game pieces
		renderPuck();
		renderPaddle(true);
		renderPaddle(false);
		renderScores(currState.player.score, currState.opponent.score);

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
	 * Render the scores
	 *
	 * @param integer player      player score
	 * @param integer opponent    opponent score
	 */
	function renderScores(player, opponent) {
		var newScale = 1/scaleFactor;
		var sidePad = width * .05;
		var bottomPad = height * .98;

		// We want precise control over text placement
		ctx.save();
		ctx.translate(0, tableHeight);
		ctx.scale(newScale, -newScale);
		ctx.font = '20px monospace';

		ctx.fillStyle = playerColor;
		ctx.fillText(player, sidePad, bottomPad);
		ctx.fillStyle = opponentColor;
		ctx.fillText(opponent, width-sidePad-ctx.measureText(opponent).width, bottomPad);

		ctx.restore();
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
	 * Translate client coords to game coords
	 *
	 * @param coord       {x:X, y:Y, r:radius}
	 * @return {x:sX, y:sY, r:sRadius} coord scaled
	 */
	function scaleToGame(coords) {
		scaled = {
			x : coords.x / scaleFactor,
			y : (height - coords.y) / scaleFactor,
			r : coords.r / scaleFactor
		}
		return scaled;
	}
}
