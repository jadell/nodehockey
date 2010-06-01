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
	board.renderBoard({
		x : board.midX,
		y : board.midY
	},{
		x : board.midX,
		y : board.height
	},{
		x : board.midX,
		y : 0
	});

	hockeytable.mousemove(function (e) {
		var x = e.pageX - this.offsetLeft;
		var y = e.pageY - this.offsetTop;
		board.renderBoard({
			x : board.midX,
			y : board.midY
		},{
			x : x,
			y : y
		},{
			x : board.midX,
			y : 0
		});
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

	var ctx = null;
	if (board.getContext) {
		ctx = board.getContext("2d");
	}

	return {
		board        : board,
		ctx          : ctx,
		height       : height,
		width        : width,
		midX         : midX,
		midY         : midY,
		renderBoard  : renderBoard,
	}

	/**
	 * Renders the game board
	 *
	 * @param puck       {x:X,y:Y} of origin
	 * @param player     {x:X,y:Y} of origin
	 * @param opponent   {x:X,y:Y} of origin
	 */
	function renderBoard(puck, player, opponent) {
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
		renderPuck(puck);
		renderPaddle(player, true);
		renderPaddle(opponent, false);

		return this;
	}

	/**
	 * Render the puck
	 *
	 * @param puck       {x:X,y:Y} of origin
	 */
	function renderPuck(puck) {
		puck = normalizePostion({
			x : width,
			y : height
		}, {
			x : puck.x,
			y : puck.y,
			radius: puckRadius
		});

		ctx.beginPath();
		ctx.fillStyle = puckColor;
		ctx.arc(puck.x,puck.y, puckRadius, radians(0),radians(360));
		ctx.fill();
		ctx.closePath();
	}

	/**
	 * Render a paddle
	 *
	 * @param paddle     {x:X,y:Y} of origin
	 * @param player     true for player, false for opponent
	 */
	function renderPaddle(paddle, player) {
		var minHeight = (player) ? midY : 0;
		var maxHeight = (player) ? height : midY;
		
		paddle = normalizePostion({
			oX : 0,
			oY : minHeight,
			mX : width,
			mY : maxHeight
		}, {
			x : paddle.x,
			y : paddle.y,
			radius: paddleRadius
		});

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
}
