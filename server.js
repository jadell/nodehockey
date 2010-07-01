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
// GameSimulator
function GameSimulator() {
	// Calculated off prototype, adjustable before we construct but not after
	var worldHalfWidth  = this.world_halfwidth;
	var worldHalfHeight = this.world_halfheight;
	var tableWidth      = this.table_width;
	var tableHeight     = this.table_height;

	var tableHalfWidth  = tableWidth / 2;
	var tableHalfHeight = tableHeight / 2;
	var goalWidth       = tableHalfWidth;
	var goalHalfWidth   = goalWidth / 2;
	var sideThicknessHalf = 0.1;
	var midfieldThicknessHalf = 0.01;

	var puck            = null;
	var puckMass        = this.puck_mass;
	var puckRadius      = this.puck_radius;
	var puckFriction    = this.puck_friction;
	var puckRestitution = this.puck_restitution;
	var puckDensity     = puckMass / (b2d.b2Settings.b2_pi * puckRadius * puckRadius);

	var player1           = null;
	var player2           = null;
	var paddleMass        = this.paddle_mass;
	var paddleRadius      = this.paddle_radius;
	var paddleFriction    = this.paddle_friction;
	var paddleRestitution = this.paddle_restitution;
	var paddleDensity     = paddleMass / (b2d.b2Settings.b2_pi * paddleRadius * paddleRadius);
	
	var puckStart    = new b2d.b2Vec2(tableHalfWidth, tableHalfHeight);
	var player1Start = new b2d.b2Vec2(tableHalfWidth, paddleRadius);
	var player2Start = new b2d.b2Vec2(tableHalfWidth, tableHeight - paddleRadius);

	// Gravity points into the board, not "down"
	var gravity = new b2d.b2Vec2(0.0, 0.0);
	var doSleep = true;
	var worldAABB = new b2d.b2AABB();
	worldAABB.lowerBound.Set(-worldHalfWidth, -worldHalfHeight);
	worldAABB.upperBound.Set( worldHalfWidth,  worldHalfHeight);
	var world = new b2d.b2World(worldAABB, gravity, doSleep);

	// Create a box entity
	function createBox(type, id, center, halfWidth, halfHeight, filterGroup) {
		var shapeDef = new b2d.b2PolygonDef();
		shapeDef.SetAsBox(halfWidth, halfHeight);
		if (filterGroup != null) {
			var filter = new b2d.b2FilterData();
			filter.groupIndex = filterGroup;
			shapeDef.filter = filter;
		}

		var bodyDef = new b2d.b2BodyDef();
		bodyDef.position.Set(center.x, center.y);
		bodyDef.userData = { type : type , id : id };
		var body = world.CreateBody(bodyDef);
		body.CreateShape(shapeDef);
		return body;
	}

	// Table boundaries
	createBox('wall', 'top', new b2d.b2Vec2(tableHalfWidth, tableHeight + sideThicknessHalf),
		tableHalfWidth, sideThicknessHalf);
	createBox('wall', 'bottom', new b2d.b2Vec2(tableHalfWidth, -sideThicknessHalf),
		tableHalfWidth, sideThicknessHalf);
	createBox('wall', 'right', new b2d.b2Vec2(tableWidth + sideThicknessHalf, tableHalfHeight),
		sideThicknessHalf, tableHalfHeight);
	createBox('wall', 'left', new b2d.b2Vec2(-sideThicknessHalf, tableHalfHeight),
		sideThicknessHalf, tableHalfHeight);
	createBox('wall', 'midfield', new b2d.b2Vec2(tableHalfWidth, tableHalfHeight),
		tableHalfWidth, midfieldThicknessHalf, -1);

	// Goals
	createBox('goal', '1', new b2d.b2Vec2(tableHalfWidth, tableHeight + sideThicknessHalf),
		goalHalfWidth, sideThicknessHalf);
	createBox('goal', '2', new b2d.b2Vec2(tableHalfWidth, -sideThicknessHalf),
		goalHalfWidth, sideThicknessHalf);

	// Create a circle entity
	function createCircle(type, id, center, radius, density, friction, restitution, filterGroup) {
		var shapeDef = new b2d.b2CircleDef();
		shapeDef.radius = radius;
		shapeDef.density = density;
		shapeDef.friction = friction;
		shapeDef.restitution = restitution;
		if (filterGroup != null) {
			var filter = new b2d.b2FilterData();
			filter.groupIndex = filterGroup;
			shapeDef.filter = filter;
		}
		
		var bodyDef = new b2d.b2BodyDef();
		bodyDef.position.Set(center.x, center.y);
		bodyDef.userData = { type : type , id : id };
		var body = world.CreateBody(bodyDef);
		body.CreateShape(shapeDef);
		body.SetMassFromShapes();
		return body;
	}
	
	// Attach a movable handle to an entity
	function attachHandle(body) {
		var handleJointDef = new b2d.b2MouseJointDef();
		handleJointDef.body1 = world.GetGroundBody();
		handleJointDef.body2 = body;
		handleJointDef.collideConnected = true;
		handleJointDef.maxForce = 10000.0 * body.GetMass();
		handleJointDef.target = body.GetPosition();
		handleJointDef.dampingRatio = 0;
		handleJointDef.frequencyHz = 100;
		var handle = world.CreateJoint(handleJointDef);
		return handle;
	}

	function updateEntityPosition(handle, x, y) {
		var newPosition = new b2d.b2Vec2(x, y);
		handle.GetBody2().WakeUp();
		handle.SetTarget(newPosition);
	}

	// Simulator interface
	this.reset = function () {
		if (puck != null) {
			world.DestroyBody(puck);
			world.DestroyBody(player1.GetBody2());
			world.DestroyBody(player2.GetBody2());
		}
		
		puck = createCircle('puck', '1', puckStart,
			puckRadius, puckDensity, puckFriction, puckRestitution, -1);
		puck.SetBullet(true);

		player1 = attachHandle(createCircle('player', '1', player1Start,
			paddleRadius, paddleDensity, paddleFriction, paddleRestitution));
		player2 = attachHandle(createCircle('player', '2', player2Start,
			paddleRadius, paddleDensity, paddleFriction, paddleRestitution));
	}
	this.reset();

	this.updatePlayer1Position = function (x, y) {
		updateEntityPosition(player1, x, y);
	}
	this.updatePlayer2Position = function (x, y) {
		updateEntityPosition(player2, x, y);
	}
	this.getTableDimensions = function () {
		return {
			width  : tableWidth,
			height : tableHeight,
			goal   : goalWidth
		};
	}
	this.getState = function () {
		var p1 = player1.GetBody2();
		var p2 = player2.GetBody2();

		var puckPos    = puck.GetPosition();
		var player1Pos = p1.GetPosition();
		var player2Pos = p2.GetPosition();
		return {
			puck : {
				x : puckPos.x,
				y : puckPos.y,
				r : puck.GetShapeList().GetRadius()
			},
			player1 : {
				x : player1Pos.x,
				y : player1Pos.y,
				r : p1.GetShapeList().GetRadius()
			},
			player2 : {
				x : player2Pos.x,
				y : player2Pos.y,
				r : p2.GetShapeList().GetRadius()
			}
		};
	}
	this.step = function (t, i) {
		world.Step(t, i);
	}
	this.setCollisionListener = function (listener) {
		var goalListener = new b2d.b2ContactListener();
		goalListener.Add = listener;
		world.SetContactListener(goalListener);
	}
}

// World dimensions
GameSimulator.prototype.world_halfwidth = 25;
GameSimulator.prototype.world_halfheight = 25;
// Tables dimensions
GameSimulator.prototype.table_width = 1.32;
GameSimulator.prototype.table_height = 2.54;
// Paddle dimensions
GameSimulator.prototype.paddle_radius = 0.1;
GameSimulator.prototype.paddle_mass = 0.8;
GameSimulator.prototype.paddle_friction = 0;
GameSimulator.prototype.paddle_restitution = 0;
// Puck dimensions
GameSimulator.prototype.puck_radius = 0.08;
GameSimulator.prototype.puck_mass = 1.0;
GameSimulator.prototype.puck_friction = 0.1;
GameSimulator.prototype.puck_restitution = 0.95;

////////////////////////////////////////////////////////////////////////////////
// Game
function Game() {
	var runIntervalId = null;
	var game = this;
	var score = {
		1 : 0,
		2 : 0
	};

	events.EventEmitter.call(this);

	var scoreOccurred = false;
	var sim = new GameSimulator();
	sim.setCollisionListener(function (point) {
		var entity1 = point.shape1.GetBody().GetUserData();
		var entity2 = point.shape2.GetBody().GetUserData();
		if (entity1.type == "puck" || entity2.type == "puck") {
			if (entity1.type == "goal" || entity2.type == "goal") {
				var goalFor = null;
				if (entity1.type == "goal") {
					goalFor = entity1.id;
				} else {
					goalFor = entity2.id;
				}
				score[goalFor]++;
				// Simulator won't let us reset in the contact handler, so flag for reset later
				scoreOccurred = true;
			}
		}
	});

	// Interface
	this.run = function () {
		runIntervalId = setInterval(function () {
				sim.step(game.simulationTimeStep, game.simulationIterations);
				if (scoreOccurred) {
					sim.reset();
					scoreOccurred = false;
				}
				var state = sim.getState();
				state.player1.score = score[1];
				state.player2.score = score[2];
				game.emit("step", state);
			}, game.frameRate);
		game.emit("run");
	}
	this.pause = function () {
		clearInterval(runIntervalId);
		game.emit("pause");
	}
	this.getTableDimensions = function () {
		return sim.getTableDimensions();
	}
	this.updatePlayer1Position = function (x, y) {
		sim.updatePlayer1Position(x, y);
	}
	this.updatePlayer2Position = function (x, y) {
		sim.updatePlayer2Position(x, y);
	}
}
sys.inherits(Game, events.EventEmitter);

Game.prototype.simulationTimeStep = 1.0 / 60.0;
Game.prototype.simulationIterations = 10;
Game.prototype.frameRate = Game.prototype.simulationTimeStep * 1000;

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
			client.sendState(state, null);
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

	state = clone(state);
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
	this.send('init', { table : table , clienttype : this.type }, message);
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
	var clients = [];

	process.addListener('uncaughtException', function (err) {
	  sys.puts('Caught exception: ' + err);
	});

	var game = new Game();
	game.run();

	var server = this;
	ws.createServer(function (ws) {
		var clientNum = clients.length;
		var clientType = GameClient.Spectator;
		if (clientNum == 0) {
			clientType = GameClient.Player1;
		} else if (clientNum == 1) {
			clientType = GameClient.Player2;
		}
		clients[clientNum] = new GameClient(server, game, ws, clientNum, clientType);
	}).listen(8080);
	
	this.removeClient = function (clientNum) {
		delete clients[clientNum];
	}
})();
