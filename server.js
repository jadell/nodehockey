var sys = require("sys"),
ws = require("./vendor/node.ws.js/ws");

const PLAYER1 = 0;
const PLAYER2 = 1;
const SPECTATOR = 2;

Object.prototype.clone = function () {
	var c = this instanceof Array ? [] : {};
	for (var i in this) {
		var prop = this[i];

		if (typeof prop == 'object') {
			if (prop instanceof Array) {
				c[i] = [];

				for (var j = 0; j < prop.length; j++) {
					if (typeof prop[j] != 'object') {
						c[i].push(prop[j]);
					} else {
						c[i].push(prop[j].clone());
					}
				}
			} else {
				c[i] = prop.clone();
			}
		} else {
			c[i] = prop;
		}
	}

	return c;
}

function GameServer() {
	var server = this;
	this.clients = [];
	
	this.height = 1.0;
	this.width  = 0.75;
	this.midH = this.height * 0.5;
	this.midW = this.width  * 0.5;
	this.resetState();
	
	ws.createServer(function (ws) {
		var clientNum = server.clients.length;
		var type = (clientNum > PLAYER2) ? SPECTATOR : clientNum;

		ws.addListener("connect", function () {
			server.sendState();
		})
		.addListener("data", function (data) {
			position = JSON.parse(data);
			server.setPlayerPosition(clientNum, position);
		})
		.addListener("close", function () {
		});

		server.clients[clientNum] = {
			ws : ws,
			id : clientNum,
			sendState : function (state) {
				this.ws.write(JSON.stringify(state));
			}
		}
	}).listen(8080);
}

GameServer.prototype.resetState = function () {
	this.state = {
		puck    : this.boundPuck({    x : 0.5 * this.width, y : 0.5 * this.height, r : 0.0375   * this.height }),
		player1 : this.boundPlayer1({ x : 0.5 * this.width, y : 1.0 * this.height, r : 0.05 * this.height }),
		player2 : this.boundPlayer2({ x : 0.5 * this.width, y : 0.0 * this.height, r : 0.05 * this.height })
	}
}

GameServer.prototype.sendState = function () {
	var gamestate;
	for (var i = 0; i < this.clients.length; i++) {
		gamestate = this.state.clone();
		if (i == PLAYER2) {
			this.reverseState(gamestate);
			gamestate.player = gamestate.player2;
			gamestate.opponent = gamestate.player1;
		} else {
			gamestate.player = gamestate.player1;
			gamestate.opponent = gamestate.player2;
		}
		delete gamestate.player1;
		delete gamestate.player2;
		this.clients[i].sendState(gamestate);
	}
}

GameServer.prototype.setPlayerPosition = function (client, position) {
	if (client == PLAYER1 || client == PLAYER2) {
		if (client == PLAYER2) {
			this.reverseEntity(position);
			this.state.player2.x = position.x;
			this.state.player2.y = position.y;
			this.boundPlayer2(this.state.player2);
		} else {
			this.state.player1.x = position.x;
			this.state.player1.y = position.y;
			this.boundPlayer1(this.state.player1);
		}
		this.sendState();
	}
}

GameServer.prototype.reverseEntity = function (entity) {
	entity.x = this.width  - entity.x;
	entity.y = this.height - entity.y;
}

GameServer.prototype.reverseState = function (state) {
	this.reverseEntity(state.player1);
	this.reverseEntity(state.player2);
}

GameServer.prototype.boundEntity = function (entity, bounds) {
	if (entity.x - entity.r < bounds.oX) {
		entity.x = bounds.oX + entity.r;
	} else if (entity.x + entity.r > bounds.mX) {
		entity.x = bounds.mX - entity.r;
	}

	if (entity.y - entity.r < bounds.oY) {
		entity.y = bounds.oY + entity.r;
	} else if (entity.y + entity.r > bounds.mY) {
		entity.y = bounds.mY - entity.r;
	}

	return entity;
}
GameServer.prototype.boundPuck = function (puck) {
	return this.boundEntity(puck, { oX:0, oY:0, mX:this.width, mY:this.height })
}
GameServer.prototype.boundPlayer1 = function (player) {
	return this.boundEntity(player, { oX:0, oY:this.midH, mX:this.width, mY:this.height })
}
GameServer.prototype.boundPlayer2 = function (player) {
	return this.boundEntity(player, { oX:0, oY:0, mX:this.width, mY:this.midH })
}

//////////////////////////////////////////////////////////////////////
// Start the game
var server = new GameServer();

