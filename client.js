$("document").ready(function (){
	var servermessage = $("#servermessage");
	var servertimeout = null;

	$("#requestbutton").click(function (e) {
		servermessage.html("Button clicked");
		servertimeout = setTimeout(function (){
			servermessage.html("&nbsp;");
		}, 1000);
	});

	// Initialize game board
	var hockeytable = $("#hockeytable");
	var board = new GameBoard(hockeytable);
	board.setEntities({
		x : board.midX,
		y : board.midY
	},{
		x : board.midX,
		y : board.height
	},{
		x : board.midX,
		y : 0
	})
	.renderBoard();

	hockeytable.mousemove(function (e) {
		var x = e.pageX - this.offsetLeft;
		var y = e.pageY - this.offsetTop;
		player = {
			x : x,
			y : y,
			r : GameBoard.paddleRadius
		};
		board.setEntities({
			x : board.midX,
			y : board.midY
		}, player, {
			x : board.midX,
			y : 0
		})
		.renderBoard();

		scaled = board.scaleToGame(player);
		servermessage.html(scaled.x + ', ' + scaled.y + ', ' + scaled.r);
	});
});

/**
 * Returns a new GameBoard object
 *
 * @param hockeytable    a JQuery object wrapped around a canvas element
 * @return GameBoard object
 */
var GameBoard = function (hockeytable) {
	const fieldColor = "#FFFFFF";

	const puckRadius = 15;
	const puckColor = "#000000";

	const paddleRadius = 20;
	const playerColor = "#0000FF";
	const opponentColor = "#FF0000";

	var board = hockeytable.get(0);
	var width = hockeytable.attr("width");
	var height = hockeytable.attr("height");
	var midX = Math.round(width/2);
	var midY = Math.round(height/2);

	var prevPuck = null;
	var prevPlayer = null;
	var prevOpponent = null;

	var currPuck = null;
	var currPlayer = null;
	var currOpponent = null;

	var ctx = null;
	if (board.getContext) {
		ctx = board.getContext("2d");
	}

	return {
		board         : board,
		ctx           : ctx,
		height        : height,
		width         : width,
		midX          : midX,
		midY          : midY,
		renderBoard   : renderBoard,
		scaleToClient : scaleToClient,
		scaleToGame   : scaleToGame,
		setEntities   : setEntities,
	}

	/**
	 * Sets the game entity positions
	 *
	 * @param puck       {x:X,y:Y} of origin
	 * @param player     {x:X,y:Y} of origin
	 * @param opponent   {x:X,y:Y} of origin
	 * @return GameBoard
	 */
	function setEntities(puck, player, opponent) {
		if (currPuck != null) {
			prevPuck = currPuck;
		}
		currPuck = normalizePostion({
			oX : 0,
			oY : 0,
			mX : width,
			mY : height
		}, {
			x : puck.x,
			y : puck.y,
			radius: puckRadius
		});

		if (currPlayer != null) {
			prevPlayer = currPlayer;
		}
		currPlayer = normalizePostion({
			oX : 0,
			oY : midY,
			mX : width,
			mY : height
		}, {
			x : player.x,
			y : player.y,
			radius: paddleRadius
		});

		if (currOpponent != null) {
			prevOpponent = currOpponent;
		}
		currOpponent = normalizePostion({
			oX : 0,
			oY : 0,
			mX : width,
			mY : midY
		}, {
			x : opponent.x,
			y : opponent.y,
			radius: paddleRadius
		});

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
		ctx.arc(currPuck.x,currPuck.y, puckRadius, radians(0),radians(360));
		ctx.fill();
		ctx.closePath();
	}

	/**
	 * Render a paddle
	 *
	 * @param player     true for player, false for opponent
	 */
	function renderPaddle(player) {
		paddle = (player) ? currPlayer : currOpponent;

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

		if (entity.x - entity.radius < bounds.oX) {
			newX = bounds.oX + entity.radius;
		} else if (entity.x + entity.radius > bounds.mX) {
			newX = bounds.mX - entity.radius;
		}

		if (entity.y - entity.radius < bounds.oY) {
			newY = bounds.oY + entity.radius;
		} else if (entity.y + entity.radius > bounds.mY) {
			newY = bounds.mY - entity.radius;
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
			x : coords.x,
			y : coords.y,
			r : coords.r
		};
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
			x : coords.x,
			y : coords.y,
			r : coords.r
		};
		return scaled;
	}
}
