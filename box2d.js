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
	this.createPuck();
	this.createPlayer(1);
	this.createPlayer(2);
}
sys.inherits(GameWorld, events.EventEmitter);
GameWorld.prototype.createPuck = function () {
	var puckShapeDef = new b2d.b2CircleDef();
	puckShapeDef.radius = this.puck_radius;
	puckShapeDef.density = this.puck_density;
	puckShapeDef.restitution = 0;

	var puckBodyDef = new b2d.b2BodyDef();
	puckBodyDef.position.Set(this.table_halfwidth, this.table_halfheight);

	this.puck = this.world.CreateBody(puckBodyDef);
	this.puck.CreateShape(puckShapeDef);
	this.puck.SetMassFromShapes();
}
GameWorld.prototype.createPlayer = function (player) {
	var playerBodyDef = new b2d.b2BodyDef();
	var playerShapeDef = new b2d.b2CircleDef();
	playerShapeDef.radius = this.paddle_radius;
	playerShapeDef.density = this.paddle_density;
	playerShapeDef.restitution = 0;

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
	var sideThicknessHalf = 0.1;

	// Table top and bottom
	var endBodyDef = new b2d.b2BodyDef();
	var endShapeDef = new b2d.b2PolygonDef();
	endShapeDef.SetAsBox(this.table_halfwidth, sideThicknessHalf);
	endShapeDef.restitution = 0;

	endBodyDef.position.Set(this.table_halfwidth, this.table_height + sideThicknessHalf);
	var topEndBody = this.world.CreateBody(endBodyDef);
	topEndBody.CreateShape(endShapeDef);

	endBodyDef.position.Set(this.table_halfwidth, -sideThicknessHalf);
	var bottomEndBody = this.world.CreateBody(endBodyDef);
	bottomEndBody.CreateShape(endShapeDef);

	// Table sides
	var sideBodyDef = new b2d.b2BodyDef();
	var sideShapeDef = new b2d.b2PolygonDef();
	sideShapeDef.SetAsBox(sideThicknessHalf, this.table_halfheight);
	endShapeDef.restitution = 0;

	sideBodyDef.position.Set(this.table_width + sideThicknessHalf, this.table_halfheight);
	var rightSideBody = this.world.CreateBody(sideBodyDef);
	rightSideBody.CreateShape(sideShapeDef);

	sideBodyDef.position.Set(-sideThicknessHalf, this.table_halfheight);
	var leftSideBody = this.world.CreateBody(sideBodyDef);
	leftSideBody.CreateShape(sideShapeDef);
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
			r : this.player1.GetShapeList().GetRadius()
		},
		player2 : {
			x : player2Pos.x,
			y : player2Pos.y,
			r : this.player2.GetShapeList().GetRadius()
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
GameWorld.prototype.frameRate = 200;
// Tables dimensions
GameWorld.prototype.table_width = 1.32;
GameWorld.prototype.table_height = 2.54;
GameWorld.prototype.table_halfwidth = GameWorld.prototype.table_width / 2;
GameWorld.prototype.table_halfheight = GameWorld.prototype.table_height / 2;
// Paddle dimensions
GameWorld.prototype.paddle_radius = 0.1;
GameWorld.prototype.paddle_mass = 0.09;
GameWorld.prototype.paddle_density =
	GameWorld.prototype.paddle_mass / (b2d.b2Settings.b2_pi * GameWorld.prototype.paddle_radius * GameWorld.prototype.paddle_radius);
// Puck dimensions
GameWorld.prototype.puck_radius = 0.08;
GameWorld.prototype.puck_mass = 0.07;
GameWorld.prototype.puck_density =
	GameWorld.prototype.puck_mass / (b2d.b2Settings.b2_pi * GameWorld.prototype.puck_radius * GameWorld.prototype.puck_radius);
// Game entities
GameWorld.prototype.puck = null;
GameWorld.prototype.player1 = null;
GameWorld.prototype.player2 = null;

////////////////////////////////////////////////////////////////////////////////
// Client
function GameClient(ws, id) {
	this.ws = ws;
	this.id = id;
	this.setPov(GameClient.Player1Pov);
}
GameClient.Player1Pov = 1;
GameClient.Player2Pov = 2;
GameClient.prototype.setPov = function (pov) {
	if (pov <= GameClient.Player1Pov) {
		this.pov = GameClient.Player1Pov;
	} else {
		this.pov = GameClient.Player2Pov;
	}
	return this;
}
GameClient.prototype.sendState = function (state, message) {
	if (this.pov == GameClient.Player2Pov) {
		this.reverseState(state);
		state.player = state.player2;
		state.opponent = state.player1;
	} else {
		state.player = state.player1;
		state.opponent = state.player2;
	}
	delete state.player1;
	delete state.player2;

	this.ws.write(JSON.stringify({
		state : state,
		message : message,
		type : 'state'
	}));
	return this;
}
GameClient.prototype.sendTable = function (table, message) {
	this.ws.write(JSON.stringify({
		table : table,
		message : message,
		type : 'init'
	}));
	return this;
};

////////////////////////////////////////////////////////////////////////////////
// Main server loop
(function () {
	var server = this;
	this.clients = [];

	var game = new GameWorld();
	game.addListener("step", function (state) {
		for (var clientNum in server.clients) {
			server.clients[clientNum].sendState(clone(state), null);
		}
	})
	// .addListener("step", function (state) {
	// 	sys.puts(sys.inspect(state));
	// })
	.run();
	
	ws.createServer(function (ws) {
		ws.addListener("connect", function () {
			var clientNum = server.clients.length;
			server.clients[clientNum] = new GameClient(ws, clientNum)
				.sendTable(game.getTableDimensions(), 'Initial table');
		})
		.addListener("data", function (data) {
			position = JSON.parse(data);
			game.updatePlayer1Position(position.x, position.y);
		});
	}).listen(8080);
})();
