var sys = require("sys"),
    b2d = require("./vendor/box2dnode/box2dnode");

function GameWorld() {
	this.createWorld();
	this.createTableBoundaries();
	this.createGameEntities();
}
GameWorld.prototype.createGameEntities = function () {
	// Puck (.08m diameter, 40g mass)
	var puckRadius = 0.04;
	var puckMass = 0.04;
	var puckDensity = puckMass / (b2d.b2Settings.b2_pi * puckRadius * puckRadius);
	
	var puckShapeDef = new b2d.b2CircleDef();
	puckShapeDef.radius = puckRadius;
	puckShapeDef.density = puckDensity;

	var puckBodyDef = new b2d.b2BodyDef();
	puckBodyDef.position.Set(0.0, 0.0);

	this.puck = this.world.CreateBody(puckBodyDef);
	this.puck.CreateShape(puckShapeDef);
	this.puck.SetMassFromShapes();
	
	// Players 1 and 2 (.10m diameter, 82g mass)
	var playerRadius = 0.05;
	var playerMass = 0.04;
	var playerDensity = playerMass / (b2d.b2Settings.b2_pi * playerRadius * playerRadius);
	
	var playerBodyDef = new b2d.b2BodyDef();
	var playerShapeDef = new b2d.b2CircleDef();
	playerShapeDef.radius = playerRadius;
	playerShapeDef.density = playerDensity; 

	playerBodyDef.position.Set(0.0, -(this.table_height/2) + playerRadius);
	this.player1 = this.world.CreateBody(playerBodyDef);
	this.player1.CreateShape(playerShapeDef);
	this.player1.SetMassFromShapes();
	
	playerBodyDef.position.Set(0.0, (this.table_height/2) - playerRadius);
	this.player2 = this.world.CreateBody(playerBodyDef);
	this.player2.CreateShape(playerShapeDef);
	this.player2.SetMassFromShapes();
}
GameWorld.prototype.createTableBoundaries = function () {
	var sideThicknessHalf = 0.1;

	// Table top and bottom
	var endBodyDef = new b2d.b2BodyDef();
	var endShapeDef = new b2d.b2PolygonDef();
	endShapeDef.SetAsBox(this.table_width/2, sideThicknessHalf);

	endBodyDef.position.Set(0.0, this.table_height/2 + sideThicknessHalf);
	var topEndBody = this.world.CreateBody(endBodyDef);
	topEndBody.CreateShape(endShapeDef);

	endBodyDef.position.Set(0.0, -(this.table_height/2 + sideThicknessHalf));
	var bottomEndBody = this.world.CreateBody(endBodyDef);
	bottomEndBody.CreateShape(endShapeDef);

	// Table sides
	var sideBodyDef = new b2d.b2BodyDef();
	var sideShapeDef = new b2d.b2PolygonDef();
	sideShapeDef.SetAsBox(sideThicknessHalf, this.table_height/2);

	sideBodyDef.position.Set(this.table_width/2 + sideThicknessHalf, 0.0);
	var rightSideBody = this.world.CreateBody(sideBodyDef);
	rightSideBody.CreateShape(sideShapeDef);

	sideBodyDef.position.Set(-(this.table_width/2 + sideThicknessHalf), 0.0);
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
GameWorld.prototype.run = function (callback) {
	this.runIntervalId = setInterval(function (game, t, i, callback) {
			game.world.Step(t, i);
			callback(game);
		}, this.simulationTimeStep * 1000.0, this, this.simulationTimeStep, this.simulationIterations, callback);
}
GameWorld.prototype.pause = function () {
	clearInterval(this.runIntervalId);
}
GameWorld.prototype.getState = function () {
	var puckPos    = this.puck.GetPosition();
	var player1Pos = this.player1.GetPosition();
	var player2Pos = this.player2.GetPosition();
	return {
		puck : {
			x : puckPosition.x,
			y : puckPosition.y,
			r : puck.GetShapeList().GetRadius()
		},
		player1 : {
			x : player1Pos.x,
			y : player1Pos.y,
			r : player1Pos.GetShapeList().GetRadius()
		},
		player2 : {
			x : player2Pos.x,
			y : player2Pos.y,
			r : player2Pos.GetShapeList().GetRadius()
		}
	}
}

GameWorld.prototype.world = null;
GameWorld.prototype.world_halfwidth = 50;
GameWorld.prototype.world_halfheight = 50;
GameWorld.prototype.simulationTimeStep = 1.0 / 60.0;
GameWorld.prototype.simulationIterations = 10;
GameWorld.prototype.runIntervalId = null;
// Tournament air-hockey tables are 2.54m x 1.32m
GameWorld.prototype.table_width = 1.32;
GameWorld.prototype.table_height = 2.54;
// game entities
GameWorld.prototype.puck = null;
GameWorld.prototype.player1 = null;
GameWorld.prototype.player2 = null;

exports.GameWorld = GameWorld;