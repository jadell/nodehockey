var sys = require("sys"),
ws = require("./vendor/node.ws.js/ws");

const PLAYER1 = 0;
const PLAYER2 = 1;
const SPECTATOR = 2;

function GameServer() {
	var server = this;
	this.clients = [];
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
		puck    : { x : 0.5, y : 0.5, r : 0.05 },
		player1 : { x : 0.5, y : 1.0, r : 0.0667 },
		player2 : { x : 0.5, y : 0.0, r : 0.0667 }
	}
}

GameServer.prototype.getState = function () {
	return {
		puck    : { x : this.state.puck.x,    y : this.state.puck.y,    r : this.state.puck.r },
		player1 : { x : this.state.player1.x, y : this.state.player1.y, r : this.state.player1.r },
		player2 : { x : this.state.player2.x, y : this.state.player2.y, r : this.state.player2.r },
	}
}

GameServer.prototype.sendState = function () {
	var gamestate;
	for (i=0; i < this.clients.length; i++) {
		gamestate = this.getState();
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
		} else {
			this.state.player1.x = position.x;
			this.state.player1.y = position.y;
		}
		this.sendState();
	}
}

GameServer.prototype.reverseEntity = function (entity) {
	entity.x = 1.0 - entity.x;
	entity.y = 1.0 - entity.y;
}

GameServer.prototype.reverseState = function (state) {
	this.reverseEntity(state.player1);
	this.reverseEntity(state.player2);
}

//////////////////////////////////////////////////////////////////////
// Start the game
var server = new GameServer();

