'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ParatiiCoreVids = undefined;

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var joi = require('joi');

/**
 * ParatiiCoreVids
 *
 */

var ParatiiCoreVids = exports.ParatiiCoreVids = function () {
  function ParatiiCoreVids(config) {
    (0, _classCallCheck3.default)(this, ParatiiCoreVids);

    var schema = joi.object({
      'db.provider': joi.string().default(null)
    }).unknown();

    var result = joi.validate(config, schema);
    var error = result.error;
    if (error) throw error;
    var options = result.value;

    this.config = options;
    this.paratii = this.config.paratii;
  }

  (0, _createClass3.default)(ParatiiCoreVids, [{
    key: 'like',
    value: function like(videoId) {
      return this.paratii.eth.vids.like(videoId);
    }
  }, {
    key: 'dislike',
    value: function dislike(videoId) {
      return this.paratii.eth.vids.dislike(videoId);
    }
  }, {
    key: 'doesLike',
    value: function doesLike(videoId) {
      return this.paratii.eth.vids.doesLike(videoId);
    }
  }, {
    key: 'hasViewedVideo',
    value: function hasViewedVideo(viewer, videoId) {
      return this.paratii.eth.vids.userViewedVideo({ viewer: viewer, videoId: videoId });
    }
  }, {
    key: 'doesDislike',
    value: function doesDislike(videoId) {
      return this.paratii.eth.vids.doesDislike(videoId);
    }
  }, {
    key: 'create',
    value: function create(options) {
      var schema, result, error, hash;
      return _regenerator2.default.async(function create$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              schema = joi.object({
                id: joi.string().default(null),
                duration: joi.string().empty('').default('').allow(null),
                owner: joi.string().required(),
                price: joi.number().default(0),
                title: joi.string().empty('').default(''),
                description: joi.string().empty('').default(''),
                file: joi.string().default(null),
                ipfsHashOrig: joi.string().empty('').default(''),
                ipfsHash: joi.string().empty('').default(''),
                author: joi.string().empty('').default('').allow(null),
                free: joi.string().empty('').default('').allow(null),
                publish: joi.string().empty('').default(false).allow(null)
              });
              result = joi.validate(options, schema);
              error = result.error;

              if (!error) {
                _context.next = 5;
                break;
              }

              throw error;

            case 5:
              options = result.value;

              if (options.id === null) {
                options.id = this.paratii.eth.vids.makeId();
              }

              _context.next = 9;
              return _regenerator2.default.awrap(this.paratii.ipfs.addAndPinJSON({
                title: options.title,
                description: options.description,
                author: options.author,
                duration: options.duration
              }));

            case 9:
              hash = _context.sent;


              options.ipfsData = hash;

              _context.next = 13;
              return _regenerator2.default.awrap(this.paratii.eth.vids.create({
                id: options.id,
                owner: options.owner,
                price: options.price,
                ipfsHashOrig: options.ipfsHashOrig,
                ipfsHash: options.ipfsHash,
                ipfsData: options.ipfsData
              }));

            case 13:
              return _context.abrupt('return', options);

            case 14:
            case 'end':
              return _context.stop();
          }
        }
      }, null, this);
    }
  }, {
    key: 'update',
    value: function update(videoId, options, dataToUpdate) {
      var data, schema, elements, dataToSave;
      return _regenerator2.default.async(function update$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              data = void 0;

              if (!dataToUpdate) {
                _context2.next = 5;
                break;
              }

              data = dataToUpdate;
              _context2.next = 8;
              break;

            case 5:
              _context2.next = 7;
              return _regenerator2.default.awrap(this.get(videoId));

            case 7:
              data = _context2.sent;

            case 8:
              if (!(data === null)) {
                _context2.next = 10;
                break;
              }

              throw new Error('No video to update');

            case 10:
              schema = joi.object({
                id: joi.string().default(null),
                owner: joi.string().required(),
                price: joi.number().default(0),
                title: joi.string().empty('').default(''),
                description: joi.string().empty('').default(''),
                duration: joi.string().empty('').default('').allow(null),
                file: joi.string().default(null),
                ipfsHashOrig: joi.string().empty('').default(''),
                ipfsHash: joi.string().empty().default(''),
                author: joi.string().empty('').default('').allow(null),
                free: joi.string().empty('').default('').allow(null),
                publish: joi.string().empty('').default('').allow(null)
              });
              elements = schema._inner.children;
              dataToSave = {};


              elements.forEach(function (name) {
                var key = name.key;
                if (options[key] !== undefined) {
                  dataToSave[key] = options[key];
                } else {
                  dataToSave[key] = data[key];
                }
              });
              _context2.next = 16;
              return _regenerator2.default.awrap(this.create(dataToSave));

            case 16:
              return _context2.abrupt('return', dataToSave);

            case 17:
            case 'end':
              return _context2.stop();
          }
        }
      }, null, this);
    }
  }, {
    key: 'upsert',
    value: function upsert(options) {
      var data;
      return _regenerator2.default.async(function upsert$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              data = null;

              if (!options.id) {
                _context3.next = 5;
                break;
              }

              _context3.next = 4;
              return _regenerator2.default.awrap(this.get(options.id));

            case 4:
              data = _context3.sent;

            case 5:
              if (data) {
                _context3.next = 9;
                break;
              }

              return _context3.abrupt('return', this.create(options));

            case 9:
              return _context3.abrupt('return', this.update(options.id, options, data));

            case 10:
            case 'end':
              return _context3.stop();
          }
        }
      }, null, this);
    }
  }, {
    key: 'view',
    value: function view(options) {
      var keysForBlockchain, optionsKeys, optionsBlockchain, optionsIpfs, hash;
      return _regenerator2.default.async(function view$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              keysForBlockchain = ['viewer', 'videoId'];
              optionsKeys = (0, _keys2.default)(options);
              optionsBlockchain = {};
              optionsIpfs = {};

              optionsKeys.forEach(function (key) {
                if (keysForBlockchain.includes(key)) {
                  optionsBlockchain[key] = options[key];
                } else {
                  optionsIpfs[key] = options[key];
                }
              });
              _context4.next = 7;
              return _regenerator2.default.awrap(this.paratii.ipfs.addJSON(optionsIpfs));

            case 7:
              hash = _context4.sent;

              optionsBlockchain['ipfsData'] = hash;
              return _context4.abrupt('return', this.paratii.eth.vids.view(optionsBlockchain));

            case 10:
            case 'end':
              return _context4.stop();
          }
        }
      }, null, this);
    }
  }, {
    key: 'get',
    value: function get(videoId) {
      return _regenerator2.default.async(function get$(_context5) {
        while (1) {
          switch (_context5.prev = _context5.next) {
            case 0:
              return _context5.abrupt('return', this.paratii.db.vids.get(videoId));

            case 1:
            case 'end':
              return _context5.stop();
          }
        }
      }, null, this);
    }
  }, {
    key: 'search',
    value: function search(options) {
      return this.paratii.db.vids.search(options);
    }
  }]);
  return ParatiiCoreVids;
}();