"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = createMap;
require("ol/ol.css");
require("./style.css");
var _ol2 = require("ol");
var _Tile = _interopRequireDefault(require("ol/layer/Tile"));
var _OSM = _interopRequireDefault(require("ol/source/OSM"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
function createMap(target, options) {
  var map = new _ol2.Map({
    target: target,
    layers: [new _Tile["default"]({
      source: new _OSM["default"]()
    })],
    view: new _ol2.View({
      center: [0, 0],
      zoom: 2
    })
  });
  return map;
}