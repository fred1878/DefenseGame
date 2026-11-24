/**
 * DefenseGame custom Phaser entry — arcade physics only, trimmed loader/game objects.
 * Built from node_modules/phaser@<version> via scripts/build-phaser-custom.mjs
 *
 * @license MIT (Phaser source is MIT; this entry file is project-authored)
 */

require("./polyfills/requestVideoFrame");

var CONST = require("./const");
var Extend = require("./utils/object/Extend");

/**
 * @namespace Phaser
 */

var Phaser = {
  Actions: require("./actions"),
  Animations: require("./animations"),
  BlendModes: require("./renderer/BlendModes"),
  Cache: require("./cache"),
  Cameras: require("./cameras"),
  Core: require("./core"),
  Class: require("./utils/Class"),
  Create: require("./create"),
  Curves: require("./curves"),
  Data: require("./data"),
  Display: require("./display"),
  DOM: require("./dom"),
  Events: require("./events"),
  FX: require("./fx"),
  Game: require("./core/Game"),
  GameObjects: require("./gameobjects"),
  Geom: require("./geom"),
  Input: require("./input"),
  Loader: require("./loader"),
  Math: require("./math"),
  Physics: {
    Arcade: require("./physics/arcade"),
  },
  Plugins: require("./plugins"),
  Renderer: require("./renderer"),
  Scale: require("./scale"),
  ScaleModes: require("./renderer/ScaleModes"),
  Scene: require("./scene/Scene"),
  Scenes: require("./scene"),
  Structs: require("./structs"),
  Textures: require("./textures"),
  Tilemaps: require("./tilemaps"),
  Time: require("./time"),
  Tweens: require("./tweens"),
  Utils: require("./utils"),
};

if (typeof FEATURE_SOUND) {
  Phaser.Sound = require("./sound");
}

if (typeof PLUGIN_CAMERA3D) {
  Phaser.Cameras.Sprite3D = require("../plugins/camera3d/src");
  Phaser.GameObjects.Sprite3D =
    require("../plugins/camera3d/src/sprite3d/Sprite3D");
  Phaser.GameObjects.Factories.Sprite3D =
    require("../plugins/camera3d/src/sprite3d/Sprite3DFactory");
  Phaser.GameObjects.Creators.Sprite3D =
    require("../plugins/camera3d/src/sprite3d/Sprite3DCreator");
}

if (typeof PLUGIN_FBINSTANT) {
  Phaser.FacebookInstantGamesPlugin =
    require("../plugins/fbinstant/src/FacebookInstantGamesPlugin");
}

Phaser = Extend(false, Phaser, CONST);

module.exports = Phaser;