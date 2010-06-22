var sys = require("sys"),
    game = require("./GameWorld"),
    ws = require("./vendor/node.ws.js/ws");

(function GameServer() {
	var server = this;
	this.clients = [];

	var game = new game.GameWorld();
	game.run(function (game) {
		state = game.getState();
		state.player = state.player1;
		state.opponent = state.player2;
		delete state.player1;
		delete state.player2;

		for (var i = 0; i < server.clients.length; i++) {
			var sendstate = {
				state : state,
				message : null
			}
			server.clients[i].sendState(sendstate);
		}
	});

	ws.createServer(function (ws) {
		var clientNum = server.clients.length;
		server.clients[clientNum] = {
			ws : ws,
			id : clientNum,
			sendState : function (state) {
				this.ws.write(JSON.stringify(state));
			}
		}
	}).listen(8080);
})();
