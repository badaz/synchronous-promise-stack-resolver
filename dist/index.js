'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.STATUS_CANCELLED = exports.STATUS_PROCESSING = exports.STATUS_RELEASING = exports.STATUS_OFF = exports.STATUS_READY = exports.STATUS_INITIALIZING = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _errors = require('./errors');

var _errors2 = _interopRequireDefault(_errors);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var STATUS_INITIALIZING = exports.STATUS_INITIALIZING = 'initializing';
var STATUS_READY = exports.STATUS_READY = 'ready';
var STATUS_OFF = exports.STATUS_OFF = 'off';
var STATUS_RELEASING = exports.STATUS_RELEASING = 'releasing';
var STATUS_PROCESSING = exports.STATUS_PROCESSING = 'processing';
var STATUS_CANCELLED = exports.STATUS_CANCELLED = 'cancelled';

var RESPONSE_STOP = 'stop';
var RESPONSE_FIRST = 'first';
var RESPONSE_ERROR = 'error';

var PromiseStackResolver = function () {
  function PromiseStackResolver() {
    var asyncStorageManager = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var eventDispatcher = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

    _classCallCheck(this, PromiseStackResolver);

    this.eventDispatcher = eventDispatcher;
    this.asyncStorageManager = asyncStorageManager;

    this.updateStorageInterval = null;
    this.processPromiseStackInterval = null;
    this.updatingStorage = false;
    this.storageUpdateRequired = false;
    this.status = STATUS_OFF;
    this.lastProcessingErrorCount = 0;
    this.lastProcessingErrorList = [];

    this.cancel = this.cancel.bind(this);
    this.init = this.init.bind(this);
    this.useAsyncStorage = this.useAsyncStorage.bind(this);
    this.useEventDispatcher = this.useEventDispatcher.bind(this);
    this.storeIndex = this.storeIndex.bind(this);
    this.updateStorage = this.updateStorage.bind(this);
    this.onUpdateStorageSuccess = this.onUpdateStorageSuccess.bind(this);
    this.onUpdateStorageError = this.onUpdateStorageError.bind(this);
    this.getStackSize = this.getStackSize.bind(this);
    this.getSecondaryStackSize = this.getSecondaryStackSize.bind(this);
    this.getLastProcessingErrorCount = this.getLastProcessingErrorCount.bind(this);
    this.getLastProcessingErrorList = this.getLastProcessingErrorList.bind(this);
    this.release = this.release.bind(this);
    this.clearStorage = this.clearStorage.bind(this);
    this.addItem = this.addItem.bind(this);
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.getStatus = this.getStatus.bind(this);
    this.isSynced = this.isSynced.bind(this);
    this.isProcessing = this.isProcessing.bind(this);
    this.processPromiseStack = this.processPromiseStack.bind(this);
    this.onPromiseSuccess = this.onPromiseSuccess.bind(this);
    this.onPromiseError = this.onPromiseError.bind(this);
    this.requestStorageUpdate = this.requestStorageUpdate.bind(this);
    this.revokeStorageUpdate = this.revokeStorageUpdate.bind(this);
    this.getIndexItem = this.getIndexItem.bind(this);
    this.setIndexItem = this.setIndexItem.bind(this);
  }

  _createClass(PromiseStackResolver, [{
    key: 'init',
    value: function init(config) {
      var _this = this;

      this.status = STATUS_INITIALIZING;

      if (!config) {
        throw new _errors2.default('config is required');
      }
      this.config = config;

      this.shouldProcessStack = config.shouldProcessStack ? config.shouldProcessStack : function () {
        return true;
      };

      this.getProcessStackStartEventList = typeof config.getProcessStackStartEventList === 'function' ? config.getProcessStackStartEventList : function () {
        return [];
      };
      this.getProcessStackEndEventList = typeof config.getProcessStackEndEventList === 'function' ? config.getProcessStackEndEventList : function () {
        return [];
      };

      if (!!config.updateAsyncStorageIntervalLength && typeof config.updateAsyncStorageIntervalLength !== 'number') {
        throw new _errors2.default('updateAsyncStorageIntervalLength must be a number');
      }
      this.updateAsyncStorageIntervalLength = config.updateAsyncStorageIntervalLength;

      if (!!config.processPromiseStackIntervalLength && typeof config.processPromiseStackIntervalLength !== 'number') {
        throw new _errors2.default('processPromiseStackIntervalLength must be a number');
      }
      this.processPromiseStackIntervalLength = config.processPromiseStackIntervalLength;

      if (!!config.useAsyncStorage && !this.asyncStorageManager) {
        throw new _errors2.default('useAsyncStorage is enabled but no asyncStorageManager is present');
      }

      this.handleError = typeof config.handleError === 'function' ? config.handleError : function () {
        return true;
      };
      this.createPromiseCaller = typeof config.createPromiseCaller === 'function' ? config.createPromiseCaller : function () {
        return function () {
          return Promise.resolve();
        };
      };

      if (this.useAsyncStorage() && (!config.pendingPromiseParamsListKey || typeof config.pendingPromiseParamsListKey !== 'string' || !config.secondaryPendingPromiseParamsListKey || typeof config.secondaryPendingPromiseParamsListKey !== 'string')) {
        throw new _errors2.default('useAsyncStorage is enabled, you must provide pendingPromiseParamsListKey and secondaryPendingPromiseParamsListKey as strings');
      }
      this.pendingPromiseParamsListKey = config.pendingPromiseParamsListKey;
      this.pendingPromiseParamsList = [];

      this.secondaryPendingPromiseParamsListKey = config.secondaryPendingPromiseParamsListKey;
      this.secondaryPendingPromiseParamsList = [];

      if (this.useAsyncStorage() && config.storeIndex && (!config.indexKey || typeof config.indexKey !== 'string')) {
        throw new _errors2.default('useAsyncStorage and storeIndex are enabled, you must provide indexKey as string');
      }
      this.index = {};
      this.indexKey = config.indexKey;

      if (!!config.useEventDispatcher && !this.eventDispatcher) {
        throw new _errors2.default('useEventDispatcher is enabled, but you did not provide an eventDispatcher');
      }

      if (this.useAsyncStorage()) {
        return this.asyncStorageManager.getItem(this.pendingPromiseParamsListKey).then(function (data) {
          if (data) {
            _this.pendingPromiseParamsList = JSON.parse(data);
          }
          return _this.asyncStorageManager.getItem(_this.secondaryPendingPromiseParamsListKey).then(function (secondaryData) {
            if (secondaryData) {
              _this.secondaryPendingPromiseParamsList = JSON.parse(secondaryData);
            }
            if (_this.storeIndex()) {
              return _this.asyncStorageManager.getItem(_this.indexKey).then(function (index) {
                if (index) {
                  _this.index = JSON.parse(index);
                }
                _this.status = STATUS_READY;
                return Promise.resolve();
              });
            }
            _this.status = STATUS_READY;
            return Promise.resolve();
          });
        });
      }
      this.status = STATUS_READY;
      return Promise.resolve();
    }
  }, {
    key: 'useAsyncStorage',
    value: function useAsyncStorage() {
      return !!this.config.useAsyncStorage && !!this.asyncStorageManager;
    }
  }, {
    key: 'useEventDispatcher',
    value: function useEventDispatcher() {
      return !!this.config.useEventDispatcher && !!this.eventDispatcher;
    }
  }, {
    key: 'storeIndex',
    value: function storeIndex() {
      return this.useAsyncStorage() && !!this.config.storeIndex && !!this.index && !!this.indexKey;
    }
  }, {
    key: 'requestStorageUpdate',
    value: function requestStorageUpdate() {
      this.storageUpdateRequired = true;
    }
  }, {
    key: 'revokeStorageUpdate',
    value: function revokeStorageUpdate() {
      this.storageUpdateRequired = false;
    }
  }, {
    key: 'updateStorage',
    value: function updateStorage() {
      var _this2 = this;

      if (this.useAsyncStorage()) {
        if (!this.updatingStorage) {
          if (this.storageUpdateRequired) {
            this.updatingStorage = true;
            return this.asyncStorageManager.setItem(this.pendingPromiseParamsListKey, JSON.stringify(this.pendingPromiseParamsList)).then(function () {
              return _this2.asyncStorageManager.setItem(_this2.secondaryPendingPromiseParamsListKey, JSON.stringify(_this2.secondaryPendingPromiseParamsList)).then(function () {
                if (_this2.storeIndex()) {
                  return _this2.asyncStorageManager.setItem(_this2.indexKey, JSON.stringify(_this2.index)).then(function () {
                    return _this2.onUpdateStorageSuccess();
                  }).catch(function () {
                    return _this2.onUpdateStorageError();
                  });
                }
                return _this2.onUpdateStorageSuccess();
              }).catch(function () {
                return _this2.onUpdateStorageError();
              });
            }).catch(function () {
              return _this2.onUpdateStorageError();
            });
          }
          return Promise.resolve();
        }
        return Promise.resolve('updating');
      }
      return Promise.resolve();
    }
  }, {
    key: 'onUpdateStorageSuccess',
    value: function onUpdateStorageSuccess() {
      this.updatingStorage = false;
      this.revokeStorageUpdate();
      return Promise.resolve();
    }
  }, {
    key: 'onUpdateStorageError',
    value: function onUpdateStorageError() {
      this.updatingStorage = false;
      return Promise.resolve();
    }
  }, {
    key: 'getIndexItem',
    value: function getIndexItem(key) {
      return this.index[key];
    }
  }, {
    key: 'setIndexItem',
    value: function setIndexItem(key, value) {
      this.index[key] = value;
    }
  }, {
    key: 'getStackSize',
    value: function getStackSize() {
      return this.status !== 'off' && this.status !== 'initializing' ? this.pendingPromiseParamsList.length : 0;
    }
  }, {
    key: 'getSecondaryStackSize',
    value: function getSecondaryStackSize() {
      return this.status !== 'off' && this.status !== 'initializing' ? this.secondaryPendingPromiseParamsList.length : 0;
    }
  }, {
    key: 'getLastProcessingErrorCount',
    value: function getLastProcessingErrorCount() {
      return this.lastProcessingErrorCount;
    }
  }, {
    key: 'getLastProcessingErrorList',
    value: function getLastProcessingErrorList() {
      return this.lastProcessingErrorList;
    }
  }, {
    key: 'release',
    value: function release() {
      var _this3 = this;

      return this.updateStorage().then(function (response) {
        if (response === 'updating') {
          return _this3.release();
        }
        _this3.status = STATUS_RELEASING;
        _this3.pendingPromiseParamsList = [];
        _this3.secondaryPendingPromiseParamsList = [];
        _this3.index = {};
        _this3.status = STATUS_OFF;
        return Promise.resolve();
      });
    }
  }, {
    key: 'clearStorage',
    value: function clearStorage() {
      var _this4 = this;

      if (this.useAsyncStorage()) {
        return this.asyncStorageManager.removeItem(this.pendingPromiseParamsListKey).then(function () {
          return _this4.asyncStorageManager.removeItem(_this4.secondaryPendingPromiseParamsListKey).then(function () {
            if (_this4.storeIndex()) {
              return _this4.asyncStorageManager.removeItem(_this4.indexKey);
            }
            return Promise.resolve();
          });
        });
      }
      return Promise.resolve();
    }
  }, {
    key: 'addItem',
    value: function addItem(object) {
      if (this.status === STATUS_READY) {
        this.pendingPromiseParamsList.push(object);
      } else {
        this.secondaryPendingPromiseParamsList.push(object);
      }
      if (this.useAsyncStorage()) {
        this.requestStorageUpdate();
      }
    }
  }, {
    key: 'start',
    value: function start() {
      var _this5 = this;

      if (this.status !== STATUS_OFF) {
        return this.stop().then(function () {
          return _this5.start();
        });
      }
      if (this.useAsyncStorage() && this.updateAsyncStorageIntervalLength) {
        this.updateStorageInterval = setInterval(function () {
          return _this5.updateStorage();
        }, this.updateAsyncStorageIntervalLength);
      }
      if (this.processPromiseStackIntervalLength) {
        this.processPromiseStackInterval = setInterval(function () {
          return _this5.processPromiseStack();
        }, this.processPromiseStackIntervalLength);
      }
      return Promise.resolve();
    }
  }, {
    key: 'stop',
    value: function stop() {
      if (this.updateStorageInterval) {
        clearInterval(this.updateStorageInterval);
      }
      if (this.processPromiseStackInterval) {
        clearInterval(this.processPromiseStackInterval);
      }
      return this.release();
    }
  }, {
    key: 'getStatus',
    value: function getStatus() {
      return this.status;
    }
  }, {
    key: 'isSynced',
    value: function isSynced() {
      return this.status === STATUS_READY && this.getStackSize() === 0 && this.getSecondaryStackSize() === 0;
    }
  }, {
    key: 'isProcessing',
    value: function isProcessing() {
      return this.status === STATUS_PROCESSING;
    }
  }, {
    key: 'cancel',
    value: function cancel() {
      this.status = STATUS_CANCELLED;
    }
  }, {
    key: 'processPromiseStack',
    value: function processPromiseStack() {
      var _this6 = this;

      if (this.shouldProcessStack() && this.status === STATUS_READY && this.getStackSize() > 0) {
        if (this.useEventDispatcher()) {
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            for (var _iterator = this.getProcessStackStartEventList()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              var event = _step.value;

              this.eventDispatcher.dispatch(event);
            }
          } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
              }
            } finally {
              if (_didIteratorError) {
                throw _iteratorError;
              }
            }
          }
        }
        this.lastProcessingErrorCount = 0;
        this.lastProcessingErrorList = [];
        this.status = STATUS_PROCESSING;
        var pendingPromiseCallerList = [];
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = this.pendingPromiseParamsList[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var pendingPromiseParams = _step2.value;

            pendingPromiseCallerList.push(this.createPromiseCaller(pendingPromiseParams, this.getIndexItem, this.setIndexItem, this.eventDispatcher));
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
            }
          }
        }

        var lastPromise = pendingPromiseCallerList.reduce(function (callerPromise, nextCaller) {
          if (_this6.shouldProcessStack() && _this6.status === STATUS_PROCESSING) {
            return callerPromise.then(function (response) {
              return _this6.onPromiseSuccess(response, nextCaller);
            }).catch(function (err) {
              _this6.lastProcessingErrorCount += 1;
              _this6.lastProcessingErrorList.push(err);
              return _this6.onPromiseError(err);
            });
          }
          return _this6.onPromiseSuccess(RESPONSE_STOP);
        }, new Promise(function (resolve) {
          return resolve(RESPONSE_FIRST);
        }));

        if (this.status !== STATUS_PROCESSING || !this.shouldProcessStack()) {
          lastPromise = this.onPromiseSuccess(RESPONSE_STOP);
        }
        return lastPromise.then(function (response) {
          return _this6.onPromiseSuccess(response);
        }).catch(function (err) {
          _this6.lastProcessingErrorCount += 1;return _this6.onPromiseError(err);
        }).then(function () {
          // once processing is done, merge secondaryPromises into pendingPromises
          _this6.pendingPromiseParamsList = _this6.pendingPromiseParamsList.concat(_this6.secondaryPendingPromiseParamsList);

          _this6.secondaryPendingPromiseParamsList = [];
          _this6.index = {};
          _this6.status = STATUS_READY;

          if (_this6.useAsyncStorage()) {
            _this6.requestStorageUpdate();
          }
          if (_this6.useEventDispatcher()) {
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;
            var _iteratorError3 = undefined;

            try {
              for (var _iterator3 = _this6.getProcessStackEndEventList()[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                var _event = _step3.value;

                _this6.eventDispatcher.dispatch(_event);
              }
            } catch (err) {
              _didIteratorError3 = true;
              _iteratorError3 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion3 && _iterator3.return) {
                  _iterator3.return();
                }
              } finally {
                if (_didIteratorError3) {
                  throw _iteratorError3;
                }
              }
            }
          }
          return Promise.resolve({});
        });
      }
      return Promise.resolve();
    }
  }, {
    key: 'onPromiseSuccess',
    value: function onPromiseSuccess(response, caller) {
      if (response !== RESPONSE_FIRST && response !== RESPONSE_STOP && response !== RESPONSE_ERROR) {
        this.pendingPromiseParamsList.shift();
        this.requestStorageUpdate();
      }
      return this.updateStorage().then(function () {
        return caller ? caller() : Promise.resolve();
      });
    }
  }, {
    key: 'onPromiseError',
    value: function onPromiseError(error) {
      this.handleError(error, this.pendingPromiseParamsList, this.getIndexItem, this.setIndexItem, this.cancel, this.eventDispatcher);
      return Promise.resolve(RESPONSE_ERROR);
    }
  }]);

  return PromiseStackResolver;
}();

exports.default = PromiseStackResolver;