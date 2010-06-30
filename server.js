/**
 * Copyright (c) 2010 Josh Adell <josh.adell@gmail.com>
 *
 * This code is licensed under the MIT License http://www.opensource.org/licenses/mit-license.php
 *
 */

var sys = require("sys"),
    b2d = require("./vendor/box2dnode/box2dnode"),
    ws = require("./vendor/node.ws.js/ws"),
    events = require("events");

////////////////////////////////////////////////////////////////////////////////
// Clone object
function clone(obj) {
	var c = obj instanceof Array ? [] : {};
	for (var i in obj) {
		var prop = obj[i];

		if (typeof prop == 'object') {
			if (prop instanceof Array) {
				c[i] = [];

				for (var j = 0; j < prop.length; j++) {
					if (typeof prop[j] != 'object') {
						c[i].push(prop[j]);
					} else {
						c[i].push(clone(prop[j]));
					}
				}
			} else {
				c[i] = clone(prop);
			}
		} else {
			c[i] = prop;
		}
	}

	return c;
};

////////////////////////////////////////////////////////////////////////////////
// GameWorld
function GameWorld() {
	events.EventEmitter.call(this);

	this.createWorld();
	this.createTableBoundaries();
	this.resetGame();
}
sys.inherits(GameWorld, events.EventEmitter);
GameWorld.prototype.resetGame = function () {
	if (this.puck != null) {
		this.world.DestroyBody(this.puck);
		this.world.DestroyBody(this.player1);
		this.world.DestroyBody(this.player2);
		this.puck = null;
		this.player1 = null;
		this.player2 = null;
	}
	
	this.createPuck();
	this.createPlayer(1);
	this.createPlayer(2);
	
	this.player1.score = 0;
	this.player2.score = 0;
}
GameWorld.prototype.createPuck = function () {
	var puckShapeDef = new b2d.b2CircleDef();
	puckShapeDef.radius = this.puck_radius;
	puckShapeDef.density = this.puck_density;
	puckShapeDef.friction = this.puck_friction;
	puckShapeDef.restitution = this.puck_restitution;

	var puckFilter = new b2d.b2FilterData();
	puckFilter.groupIndex = -1;
	puckShapeDef.filter = puckFilter;

	var puckBodyDef = new b2d.b2BodyDef();
	puckBodyDef.position.Set(this.table_halfwidth, this.table_halfheight);
	puckBodyDef.bullet = true;

	this.puck = this.world.CreateBody(puckBodyDef);
	this.puck.CreateShape(puckShapeDef);
	this.puck.SetMassFromShapes();
}
GameWorld.prototype.createPlayer = function (player) {
	var playerShapeDef = new b2d.b2CircleDef();
	playerShapeDef.radius = this.paddle_radius;
	playerShapeDef.density = this.paddle_density;
	playerShapeDef.friction = this.paddle_friction;
	playerShapeDef.restitution = this.paddle_restitution;

	var playerBodyDef = new b2d.b2BodyDef();
	if (player == 1) {
		playerBodyDef.position.Set(this.table_halfwidth, this.paddle_radius);
	} else {
		playerBodyDef.position.Set(this.table_halfwidth, this.table_height - this.paddle_radius);
	}

	var body = this.world.CreateBody(playerBodyDef);
	body.CreateShape(playerShapeDef);
	body.SetMassFromShapes();

	var handleJointDef = new b2d.b2MouseJointDef();
	handleJointDef.body1 = this.world.m_groundBody;
	handleJointDef.body2 = body;
	handleJointDef.collideConnected = true;
	handleJointDef.maxForce = 10000.0 * body.GetMass();
	handleJointDef.target = body.GetPosition();
	handleJointDef.dampingRatio = 0;
	handleJointDef.frequencyHz = 100;
	body.handle = this.world.CreateJoint(handleJointDef);
	
	if (player == 1) {
		this.player1 = body;
	} else {
		this.player2 = body;
	}
}
GameWorld.prototype.createTableBoundaries = function () {
	// Table top and bottom
	var endBodyDef = new b2d.b2BodyDef();
	var endShapeDef = new b2d.b2PolygonDef();
	endShapeDef.SetAsBox(this.table_halfwidth, this.table_sideThicknessHalf);

	endBodyDef.position.Set(this.table_halfwidth, this.table_height + this.table_sideThicknessHalf);
	var topEndBody = this.world.CreateBody(endBodyDef);
	topEndBody.CreateShape(endShapeDef);

	endBodyDef.position.Set(this.table_halfwidth, -this.table_sideThicknessHalf);
	var bottomEndBody = this.world.CreateBody(endBodyDef);
	bottomEndBody.CreateShape(endShapeDef);

	// Table sides
	var sideBodyDef = new b2d.b2BodyDef();
	var sideShapeDef = new b2d.b2PolygonDef();
	sideShapeDef.SetAsBox(this.table_sideThicknessHalf, this.table_halfheight);

	sideBodyDef.position.Set(this.table_width + this.table_sideThicknessHalf, this.table_halfheight);
	var rightSideBody = this.world.CreateBody(sideBodyDef);
	rightSideBody.CreateShape(sideShapeDef);

	sideBodyDef.position.Set(-this.table_sideThicknessHalf, this.table_halfheight);
	var leftSideBody = this.world.CreateBody(sideBodyDef);
	leftSideBody.CreateShape(sideShapeDef);
	
	// Mid-field os a line that puck can cross but not paddles
	var midfieldShapeDef = new b2d.b2PolygonDef();
	var midfieldFilter = new b2d.b2FilterData();
	var midfieldBodyDef = new b2d.b2BodyDef();

	midfieldShapeDef.SetAsBox(this.table_halfwidth, this.table_midfieldThicknessHalf);
	midfieldFilter.groupIndex = -1;
	midfieldShapeDef.filter = midfieldFilter;
	
	midfieldBodyDef.position.Set(this.table_halfwidth, this.table_halfheight);
	var midfieldBody = this.world.CreateBody(midfieldBodyDef);
	midfieldBody.CreateShape(midfieldShapeDef);
}
GameWorld.prototype.createWorld = function () {
	var worldAABB = new b2d.b2AABB();
	worldAABB.lowerBound.Set(-this.world_halfwidth, -this.world_halfheight);
	worldAABB.upperBound.Set( this.world_halfwidth,  this.world_halfheight);
	// No gravity, camera is looking straight down
	var gravity = new b2d.b2Vec2(0.0, 0.0);
	var doSleep = true;
	this.world = new b2d.b2World(worldAABB, gravity, doSleep);
}
GameWorld.prototype.run = function () {
	this.runIntervalId = setInterval(function (game, t, i) {
			game.world.Step(t, i);
			game.emit("step", game.getState());
		}, this.frameRate, this, this.simulationTimeStep, this.simulationIterations);
		
	this.emit("run");
}
GameWorld.prototype.pause = function () {
	clearInterval(this.runIntervalId);
	this.emit("pause");
}
GameWorld.prototype.getState = function () {
	var puckPos    = this.puck.GetPosition();
	var player1Pos = this.player1.GetPosition();
	var player2Pos = this.player2.GetPosition();
	return {
		puck : {
			x : puckPos.x,
			y : puckPos.y,
			r : this.puck.GetShapeList().GetRadius()
		},
		player1 : {
			x : player1Pos.x,
			y : player1Pos.y,
			r : this.player1.GetShapeList().GetRadius(),
			score : this.player1.score
		},
		player2 : {
			x : player2Pos.x,
			y : player2Pos.y,
			r : this.player2.GetShapeList().GetRadius(),
			score : this.player2.score
		}
	}
}
GameWorld.prototype.getTableDimensions = function () {
	return {
		width : this.table_width,
		height : this.table_height,
	}
}
GameWorld.prototype.updatePlayerPosition = function (player, x, y) {
	var newPosition = new b2d.b2Vec2(x, y);
	player.WakeUp();
	player.handle.SetTarget(newPosition);
}
GameWorld.prototype.updatePlayer1Position = function (x, y) {
	this.updatePlayerPosition(this.player1, x, y);
}
GameWorld.prototype.updatePlayer2Position = function (x, y) {
	this.updatePlayerPosition(this.player2, x, y);
}

GameWorld.prototype.world = null;
GameWorld.prototype.world_halfwidth = 25;
GameWorld.prototype.world_halfheight = 25;
GameWorld.prototype.simulationTimeStep = 1.0 / 60.0;
GameWorld.prototype.simulationIterations = 10;
GameWorld.prototype.runIntervalId = null;
GameWorld.prototype.frameRate = GameWorld.prototype.simulationTimeStep * 1000;
// Tables dimensions
GameWorld.prototype.table_width = 1.32;
GameWorld.prototype.table_height = 2.54;
GameWorld.prototype.table_halfwidth = GameWorld.prototype.table_width / 2;
GameWorld.prototype.table_halfheight = GameWorld.prototype.table_height / 2;
// Boundary dimensions
GameWorld.prototype.table_sideThickness = 0.2;
GameWorld.prototype.table_midfieldThickness = 0.02;
GameWorld.prototype.table_sideThicknessHalf =
	GameWorld.prototype.table_sideThickness / 2;
GameWorld.prototype.table_midfieldThicknessHalf =
	GameWorld.prototype.table_midfieldThickness / 2;
// Paddle dimensions
GameWorld.prototype.paddle_radius = 0.1;
GameWorld.prototype.paddle_mass = 0.09;
GameWorld.prototype.paddle_density =
	GameWorld.prototype.paddle_mass / (b2d.b2Settings.b2_pi * GameWorld.prototype.paddle_radius * GameWorld.prototype.paddle_radius);
GameWorld.prototype.paddle_friction = 0;
GameWorld.prototype.paddle_restitution = 0;
// Puck dimensions
GameWorld.prototype.puck_radius = 0.08;
GameWorld.prototype.puck_mass = 4.0;
GameWorld.prototype.puck_density =
	GameWorld.prototype.puck_mass / (b2d.b2Settings.b2_pi * GameWorld.prototype.puck_radius * GameWorld.prototype.puck_radius);
GameWorld.prototype.puck_friction = 0.1;
GameWorld.prototype.puck_restitution = 0.95;
// Game entities
GameWorld.prototype.puck = null;
GameWorld.prototype.player1 = null;
GameWorld.prototype.player2 = null;

////////////////////////////////////////////////////////////////////////////////
// Client
function GameClient(server, game, ws, id, type) {
	this.server = server;
	this.game = game;
	this.ws = ws;
	this.id = id;
	this.type = type;
	this.pov = type;
	this.table = game.getTableDimensions();

	var client = this;
	this.ws.addListener("connect", function () {
			client.sendTable(client.table, 'Initial table');
			client.ready = true;
		})
		.addListener("data", function (data) {
			if (client.type == GameClient.Spectator) {
				return;
			}

			var position = JSON.parse(data);
			var updatePosition = client.game.updatePlayer1Position;
			if (client.type == GameClient.Player2) {
				client.reverseEntity(position);
				updatePosition = client.game.updatePlayer2Position;
			}
			updatePosition.call(client.game, position.x, position.y);
		})
		.addListener("close", function () {
			client.ready = false;
			client.server.removeClient(client.id);
		});
		
	this.game.addListener("step", function (state) {
			client.sendState(clone(state), null);
		});
}
GameClient.prototype.send = function (type, data, message) {
	data.type = type;
	data.message = message;
	this.ws.write(JSON.stringify(data));
}
GameClient.prototype.sendState = function (state, message) {
	if (this.ready == false) {
		return this;
	}

	if (this.pov == GameClient.Player2) {
		this.reverseState(state);
		state.player = state.player2;
		state.opponent = state.player1;
	} else {
		state.player = state.player1;
		state.opponent = state.player2;
	}
	delete state.player1;
	delete state.player2;

	this.send('state', { state : state }, message);
	return this;
}
GameClient.prototype.sendTable = function (table, message) {
	this.send('init', { table : table }, message);
}
GameClient.prototype.reverseEntity = function (entity) {
	entity.x = this.table.width  - entity.x;
	entity.y = this.table.height - entity.y;
}
GameClient.prototype.reverseState = function (state) {
	this.reverseEntity(state.player1);
	this.reverseEntity(state.player2);
	this.reverseEntity(state.puck);
}

GameClient.Player1   = '1';
GameClient.Player2   = '2';
GameClient.Spectator = 'S';

GameClient.prototype.ready = false;

////////////////////////////////////////////////////////////////////////////////
// Main server loop
;(function () {
	this.clients = [];

	process.addListener('uncaughtException', function (err) {
	  sys.puts('Caught exception: ' + err);
	});

	var game = new GameWorld();
	game.run();

	var server = this;
	ws.createServer(function (ws) {
		var clientNum = server.clients.length;
		var clientType = GameClient.Spectator;
		if (clientNum == 0) {
			clientType = GameClient.Player1;
		} else if (clientNum == 1) {
			clientType = GameClient.Player2;
		}
		server.clients[clientNum] = new GameClient(server, game, ws, clientNum, clientType);
	}).listen(8080);
	
	this.removeClient = function (id) {
		delete this.clients[id];
	}
})();
