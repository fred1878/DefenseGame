/**
 * @see vendor/phaser-trim/README.md — installed over phaser/src/gameobjects/index.js during build:phaser
 */

var GameObjects = {
  Events: require("./events"),

  DisplayList: require("./DisplayList"),
  GameObjectCreator: require("./GameObjectCreator"),
  GameObjectFactory: require("./GameObjectFactory"),
  UpdateList: require("./UpdateList"),

  Components: require("./components"),
  GetCalcMatrix: require("./GetCalcMatrix"),

  BuildGameObject: require("./BuildGameObject"),
  BuildGameObjectAnimation: require("./BuildGameObjectAnimation"),
  GameObject: require("./GameObject"),
  Container: require("./container/Container"),
  Graphics: require("./graphics/Graphics"),
  Group: require("./group/Group"),
  Image: require("./image/Image"),
  Layer: require("./layer/Layer"),
  RenderTexture: require("./rendertexture/RenderTexture"),
  Sprite: require("./sprite/Sprite"),

  Text: require("./text/Text"),
  GetTextSize: require("./text/GetTextSize"),
  MeasureText: require("./text/MeasureText"),
  TextStyle: require("./text/TextStyle"),

  Zone: require("./zone/Zone"),

  Shape: require("./shape/Shape"),
  Arc: require("./shape/arc/Arc"),
  Ellipse: require("./shape/ellipse/Ellipse"),
  Line: require("./shape/line/Line"),
  Polygon: require("./shape/polygon/Polygon"),
  Rectangle: require("./shape/rectangle/Rectangle"),
  Star: require("./shape/star/Star"),

  Factories: {
    Container: require("./container/ContainerFactory"),
    Graphics: require("./graphics/GraphicsFactory"),
    Group: require("./group/GroupFactory"),
    Image: require("./image/ImageFactory"),
    Layer: require("./layer/LayerFactory"),
    RenderTexture: require("./rendertexture/RenderTextureFactory"),
    Sprite: require("./sprite/SpriteFactory"),
    Text: require("./text/TextFactory"),
    Zone: require("./zone/ZoneFactory"),

    Arc: require("./shape/arc/ArcFactory"),
    Ellipse: require("./shape/ellipse/EllipseFactory"),
    Line: require("./shape/line/LineFactory"),
    Polygon: require("./shape/polygon/PolygonFactory"),
    Rectangle: require("./shape/rectangle/RectangleFactory"),
    Star: require("./shape/star/StarFactory"),
  },

  Creators: {
    Container: require("./container/ContainerCreator"),
    Graphics: require("./graphics/GraphicsCreator"),
    Group: require("./group/GroupCreator"),
    Image: require("./image/ImageCreator"),
    Layer: require("./layer/LayerCreator"),
    RenderTexture: require("./rendertexture/RenderTextureCreator"),
    Sprite: require("./sprite/SpriteCreator"),
    Text: require("./text/TextCreator"),
    Zone: require("./zone/ZoneCreator"),
  },
};

if (typeof WEBGL_RENDERER) {
  GameObjects.NineSlice = require("./nineslice/NineSlice");

  GameObjects.Factories.NineSlice = require("./nineslice/NineSliceFactory");

  GameObjects.Creators.NineSlice = require("./nineslice/NineSliceCreator");
}

module.exports = GameObjects;