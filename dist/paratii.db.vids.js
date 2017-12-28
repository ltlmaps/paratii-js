"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ParatiiDbVids = undefined;

var _regenerator = require("babel-runtime/regenerator");

var _regenerator2 = _interopRequireDefault(_regenerator);

var _assign = require("babel-runtime/core-js/object/assign");

var _assign2 = _interopRequireDefault(_assign);

var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require("babel-runtime/helpers/createClass");

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * ParatiiDb contains a functionality to interact with the Paratii Blockchain Index
 *
 */
var ParatiiDbVids = exports.ParatiiDbVids = function () {
  function ParatiiDbVids(config) {
    (0, _classCallCheck3.default)(this, ParatiiDbVids);

    this.config = config;
  }

  (0, _createClass3.default)(ParatiiDbVids, [{
    key: "get",
    value: function get(videoId) {
      var paratii, videoFromBC, videoFromIPFS;
      return _regenerator2.default.async(function get$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              // This should be a request on the web API (that is not there yet)
              paratii = this.config.paratii;
              // TODO: optimize and do these requests in parallel

              _context.next = 3;
              return _regenerator2.default.awrap(paratii.eth.vids.get(videoId));

            case 3:
              videoFromBC = _context.sent;
              _context.next = 6;
              return _regenerator2.default.awrap(paratii.ipfs.getJSON(videoFromBC.ipfsHash));

            case 6:
              videoFromIPFS = _context.sent;
              return _context.abrupt("return", (0, _assign2.default)({}, videoFromIPFS, videoFromBC));

            case 8:
            case "end":
              return _context.stop();
          }
        }
      }, null, this);
    }
  }]);
  return ParatiiDbVids;
}();