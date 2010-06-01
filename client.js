const puckRadius = 15;
const puckColor = "#000000";

const paddleRadius = 20;
const playerColor = "#0000FF";
const opponentColor = "#FF0000";

$("document").ready(function (){
	var servermessage = $("#servermessage");
	var servertimeout = null;

	$("#requestbutton").click(function (event) {
		servermessage.html("Button clicked");
		servertimeout = setTimeout(function (){
			servermessage.html("&nbsp;");
		}, 1000);
	});

	// Initialize game board
	var hockeytable = $("#hockeytable");
	var maxHeight = hockeytable.attr("height");
	var maxWidth  = hockeytable.attr("width");
	var midX = Math.round(maxWidth/2);
	var midY = Math.round(maxHeight/2);
	var ctx = hockeytable.get(0).getContext("2d");
	renderBoard({
		ctx    : ctx,
		width  : maxWidth,
		height : maxHeight,
	},{
		x : midX,
		y : midY
	},{
		x : midX,
		y : maxHeight
	},{
		x : midX,
		y : 0
	});
});

/**
 * Renders the game board on the supplied canvas
 *
 * @param board      {ctx:rendering context,width:maxWidth,height:maxHeight}
 * @param puck       {x:X,y:Y} of origin
 * @param player     {x:X,y:Y} of origin
 * @param opponent   {x:X,y:Y} of origin
 */
var renderBoard = function (board, puck, player, opponent) {
	// Border
	board.ctx.strokeRect(0,0, board.width,board.height);

	// Mid-field
	midY = Math.round(board.height/2);
	board.ctx.moveTo(0, midY);
	board.ctx.lineTo(board.width, midY);
	board.ctx.stroke();

	// Game pieces
	renderPuck(board, puck);
	renderPaddle(board, player, true);
	renderPaddle(board, opponent, false);

	return;
}

/**
 * Render the puck
 *
 * @param board      {ctx:rendering context,width:maxWidth,height:maxHeight}
 * @param puck       {x:X,y:Y} of origin
 */
var renderPuck = function (board, puck) {
	puck = normalizePostion({
		x : board.width,
		y : board.height
	}, {
		x : puck.x,
		y : puck.y,
		radius: puckRadius
	});

	board.ctx.beginPath();
	board.ctx.fillStyle = puckColor;
	board.ctx.arc(puck.x,puck.y, puckRadius, radians(0),radians(360));
	board.ctx.fill();
}

/**
 * Render a paddle
 *
 * @param board      {ctx:rendering context,width:maxWidth,height:maxHeight}
 * @param paddle     {x:X,y:Y} of origin
 * @param player     true for player, false for opponent
 */
var renderPaddle = function (board, paddle, player) {
	paddle = normalizePostion({
		x : board.width,
		y : board.height
	}, {
		x : paddle.x,
		y : paddle.y,
		radius: paddleRadius
	});

	board.ctx.beginPath();
	board.ctx.fillStyle = (player) ? playerColor : opponentColor;
	board.ctx.arc(paddle.x,paddle.y, paddleRadius, radians(0),radians(360));
	board.ctx.fill();
}

/**
 * Make sure an entity is entirely within the game board
 * @param bounds       {x:maxX,y:maxY}
 * @param entity       {x:X of origin,y:Y of origin,r:radius}
 * @return {x:X, y:Y} new origin
 */
var normalizePostion = function (bounds, entity) {
	var newX = entity.x;
	var newY = entity.y;

	if (entity.x - entity.radius < 0) {
		newX = entity.radius;
	} else if (entity.x + entity.radius > bounds.x) {
		newX = bounds.x - entity.radius;
	}

	if (entity.y - entity.radius < 0) {
		newY = entity.radius;
	} else if (entity.y + entity.radius > bounds.y) {
		newY = bounds.y - entity.radius;
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
var radians = function (degrees) {
	return (Math.PI/180) * degrees;
}