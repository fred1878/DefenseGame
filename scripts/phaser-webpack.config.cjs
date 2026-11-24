"use strict";

const path = require("path");
const webpack = require("webpack");
const repoRoot = path.join(__dirname, "..");
const phaserSrc = path.join(repoRoot, "node_modules/phaser/src");
const entryTmp = path.join(phaserSrc, ".phaser-defense-entry.js");

module.exports = {
  mode: "production",
  context: phaserSrc,
  entry: entryTmp,
  output: {
    path: path.join(repoRoot, "vendor"),
    filename: "phaser-defense.js",
    library: {
      name: "Phaser",
      type: "umd",
      umdNamedDefine: true,
    },
    globalObject: "this",
  },
  performance: { hints: false },
  // Vite/Rollup minifies the vendor chunk; keep this bundle readable for CJS interop.
  optimization: {
    minimize: false,
  },
  plugins: [
    new webpack.DefinePlugin({
      "typeof CANVAS_RENDERER": JSON.stringify(true),
      "typeof WEBGL_RENDERER": JSON.stringify(true),
      "typeof WEBGL_DEBUG": JSON.stringify(false),
      "typeof EXPERIMENTAL": JSON.stringify(false),
      "typeof PLUGIN_3D": JSON.stringify(false),
      "typeof PLUGIN_CAMERA3D": JSON.stringify(false),
      "typeof PLUGIN_FBINSTANT": JSON.stringify(false),
      "typeof FEATURE_SOUND": JSON.stringify(true),
    }),
  ],
};