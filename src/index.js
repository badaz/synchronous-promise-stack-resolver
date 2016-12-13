import PromiseStackResolverError from './errors';

export const STATUS_INITIALIZING = 'initializing';
export const STATUS_READY = 'ready';
export const STATUS_OFF = 'off';
export const STATUS_RELEASING = 'releasing';
export const STATUS_PROCESSING = 'processing';
export const STATUS_CANCELLED = 'cancelled';

const RESPONSE_STOP = 'stop';
const RESPONSE_FIRST = 'first';
const RESPONSE_ERROR = 'error';

class PromiseStackResolver {
  constructor(asyncStorageManager = null, eventDispatcher = null) {
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

  init(config) {
    this.status = STATUS_INITIALIZING;

    if (!config) {
      throw new PromiseStackResolverError('config is required');
    }
    this.config = config;

    this.shouldProcessStack = config.shouldProcessStack ? config.shouldProcessStack : () => true;

    this.getProcessStackStartEventList = typeof config.getProcessStackStartEventList === 'function' ? config.getProcessStackStartEventList : () => [];
    this.getProcessStackEndEventList = typeof config.getProcessStackEndEventList === 'function' ? config.getProcessStackEndEventList : () => [];

    if (!!config.updateAsyncStorageIntervalLength && typeof config.updateAsyncStorageIntervalLength !== 'number') {
      throw new PromiseStackResolverError('updateAsyncStorageIntervalLength must be a number');
    }
    this.updateAsyncStorageIntervalLength = config.updateAsyncStorageIntervalLength;

    if (!!config.processPromiseStackIntervalLength && typeof config.processPromiseStackIntervalLength !== 'number') {
      throw new PromiseStackResolverError('processPromiseStackIntervalLength must be a number');
    }
    this.processPromiseStackIntervalLength = config.processPromiseStackIntervalLength;

    if (!!config.useAsyncStorage && !this.asyncStorageManager) {
      throw new PromiseStackResolverError('useAsyncStorage is enabled but no asyncStorageManager is present');
    }

    this.handleError = typeof config.handleError === 'function' ? config.handleError : () => true;
    this.createPromiseCaller = typeof config.createPromiseCaller === 'function' ? config.createPromiseCaller : () => () => Promise.resolve();

    if (this.useAsyncStorage() &&
      (!config.pendingPromiseParamsListKey ||
        typeof config.pendingPromiseParamsListKey !== 'string' ||
        !config.secondaryPendingPromiseParamsListKey ||
        typeof config.secondaryPendingPromiseParamsListKey !== 'string')) {
      throw new PromiseStackResolverError('useAsyncStorage is enabled, you must provide pendingPromiseParamsListKey and secondaryPendingPromiseParamsListKey as strings');
    }
    this.pendingPromiseParamsListKey = config.pendingPromiseParamsListKey;
    this.pendingPromiseParamsList = [];

    this.secondaryPendingPromiseParamsListKey = config.secondaryPendingPromiseParamsListKey;
    this.secondaryPendingPromiseParamsList = [];

    if (this.useAsyncStorage() && config.storeIndex &&
      (!config.indexKey ||
        typeof config.indexKey !== 'string')) {
      throw new PromiseStackResolverError('useAsyncStorage and storeIndex are enabled, you must provide indexKey as string');
    }
    this.index = {};
    this.indexKey = config.indexKey;

    if (!!config.useEventDispatcher && !this.eventDispatcher) {
      throw new PromiseStackResolverError('useEventDispatcher is enabled, but you did not provide an eventDispatcher');
    }

    if (this.useAsyncStorage()) {
      return this.asyncStorageManager.getItem(this.pendingPromiseParamsListKey)
        .then((data) => {
          if (data) {
            this.pendingPromiseParamsList = JSON.parse(data);
          }
          return this.asyncStorageManager.getItem(this.secondaryPendingPromiseParamsListKey)
            .then((secondaryData) => {
              if (secondaryData) {
                this.secondaryPendingPromiseParamsList = JSON.parse(secondaryData);
              }
              if (this.storeIndex()) {
                return this.asyncStorageManager.getItem(this.indexKey)
                  .then((index) => {
                    if (index) {
                      this.index = JSON.parse(index);
                    }
                    this.status = STATUS_READY;
                    return Promise.resolve();
                  });
              }
              this.status = STATUS_READY;
              return Promise.resolve();
            })
          ;
        })
      ;
    }
    this.status = STATUS_READY;
    return Promise.resolve();
  }

  useAsyncStorage() {
    return !!this.config.useAsyncStorage && !!this.asyncStorageManager;
  }

  useEventDispatcher() {
    return !!this.config.useEventDispatcher && !!this.eventDispatcher;
  }

  storeIndex() {
    return this.useAsyncStorage() && !!this.config.storeIndex && !!this.index && !!this.indexKey;
  }

  requestStorageUpdate() {
    this.storageUpdateRequired = true;
  }

  revokeStorageUpdate() {
    this.storageUpdateRequired = false;
  }

  updateStorage() {
    if (this.useAsyncStorage()) {
      if (!this.updatingStorage) {
        if (this.storageUpdateRequired) {
          this.updatingStorage = true;
          return this.asyncStorageManager.setItem(
            this.pendingPromiseParamsListKey, JSON.stringify(this.pendingPromiseParamsList))
          .then(() =>
            this.asyncStorageManager.setItem(
              this.secondaryPendingPromiseParamsListKey,
                JSON.stringify(this.secondaryPendingPromiseParamsList))
              .then(() => {
                if (this.storeIndex()) {
                  return this.asyncStorageManager.setItem(this.indexKey, JSON.stringify(this.index))
                    .then(() => this.onUpdateStorageSuccess())
                    .catch(() => this.onUpdateStorageError());
                }
                return this.onUpdateStorageSuccess();
              })
              .catch(() => this.onUpdateStorageError()),
          )
          .catch(() => this.onUpdateStorageError());
        }
        return Promise.resolve();
      }
      return Promise.resolve('updating');
    }
    return Promise.resolve();
  }

  onUpdateStorageSuccess() {
    this.updatingStorage = false;
    this.revokeStorageUpdate();
    return Promise.resolve();
  }

  onUpdateStorageError() {
    this.updatingStorage = false;
    return Promise.resolve();
  }

  getIndexItem(key) {
    return this.index[key];
  }

  setIndexItem(key, value) {
    this.index[key] = value;
  }

  getStackSize() {
    return (this.status !== 'off' && this.status !== 'initializing') ?
      this.pendingPromiseParamsList.length : 0;
  }

  getSecondaryStackSize() {
    return (this.status !== 'off' && this.status !== 'initializing') ?
      this.secondaryPendingPromiseParamsList.length : 0;
  }

  getLastProcessingErrorCount() {
    return this.lastProcessingErrorCount;
  }

  getLastProcessingErrorList() {
    return this.lastProcessingErrorList;
  }

  release() {
    return this.updateStorage().then((response) => {
      if (response === 'updating') {
        return this.release();
      }
      this.status = STATUS_RELEASING;
      this.pendingPromiseParamsList = [];
      this.secondaryPendingPromiseParamsList = [];
      this.index = {};
      this.status = STATUS_OFF;
      return Promise.resolve();
    });
  }

  clearStorage() {
    if (this.useAsyncStorage()) {
      return this.asyncStorageManager.removeItem(this.pendingPromiseParamsListKey).then(() =>
        this.asyncStorageManager.removeItem(this.secondaryPendingPromiseParamsListKey).then(() => {
          if (this.storeIndex()) {
            return this.asyncStorageManager.removeItem(this.indexKey);
          }
          return Promise.resolve();
        }),
      );
    }
    return Promise.resolve();
  }

  addItem(object) {
    if (this.status === STATUS_READY) {
      this.pendingPromiseParamsList.push(object);
    } else {
      this.secondaryPendingPromiseParamsList.push(object);
    }
    if (this.useAsyncStorage()) {
      this.requestStorageUpdate();
    }
  }

  start() {
    if (this.status !== STATUS_OFF) {
      return this.stop().then(() => this.start());
    }
    if (this.useAsyncStorage() && this.updateAsyncStorageIntervalLength) {
      this.updateStorageInterval =
        setInterval(() => this.updateStorage(), this.updateAsyncStorageIntervalLength);
    }
    if (this.processPromiseStackIntervalLength) {
      this.processPromiseStackInterval =
        setInterval(() => this.processPromiseStack(), this.processPromiseStackIntervalLength);
    }
    return Promise.resolve();
  }

  stop() {
    if (this.updateStorageInterval) {
      clearInterval(this.updateStorageInterval);
    }
    if (this.processPromiseStackInterval) {
      clearInterval(this.processPromiseStackInterval);
    }
    return this.release();
  }

  getStatus() {
    return this.status;
  }

  isSynced() {
    return this.status === STATUS_READY &&
      this.getStackSize() === 0 && this.getSecondaryStackSize() === 0;
  }

  isProcessing() {
    return this.status === STATUS_PROCESSING;
  }

  cancel() {
    this.status = STATUS_CANCELLED;
  }

  processPromiseStack() {
    if (this.shouldProcessStack() && this.status === STATUS_READY && this.getStackSize() > 0) {
      if (this.useEventDispatcher()) {
        for (const event of this.getProcessStackStartEventList()) {
          this.eventDispatcher.dispatch(event);
        }
      }
      this.lastProcessingErrorCount = 0;
      this.lastProcessingErrorList = [];
      this.status = STATUS_PROCESSING;
      const pendingPromiseCallerList = [];
      for (const pendingPromiseParams of this.pendingPromiseParamsList) {
        pendingPromiseCallerList.push(
          this.createPromiseCaller(
            pendingPromiseParams,
            this.getIndexItem,
            this.setIndexItem,
            this.eventDispatcher,
          ),
        );
      }

      let lastPromise = pendingPromiseCallerList.reduce((callerPromise, nextCaller) => {
        if (this.shouldProcessStack() && this.status === STATUS_PROCESSING) {
          return callerPromise
            .then(response => this.onPromiseSuccess(response, nextCaller))
            .catch((err) => {
              this.lastProcessingErrorCount += 1;
              this.lastProcessingErrorList.push(err);
              return this.onPromiseError(err);
            });
        }
        return this.onPromiseSuccess(RESPONSE_STOP);
      }, new Promise(resolve => resolve(RESPONSE_FIRST)));

      if (this.status !== STATUS_PROCESSING || !this.shouldProcessStack()) {
        lastPromise = this.onPromiseSuccess(RESPONSE_STOP);
      }
      return lastPromise.then(response => this.onPromiseSuccess(response))
        .catch((err) => { this.lastProcessingErrorCount += 1; return this.onPromiseError(err); })
        .then(() => {
          // once processing is done, merge secondaryPromises into pendingPromises
          this.pendingPromiseParamsList =
            this.pendingPromiseParamsList.concat(this.secondaryPendingPromiseParamsList);

          this.secondaryPendingPromiseParamsList = [];
          this.index = {};
          this.status = STATUS_READY;

          if (this.useAsyncStorage()) {
            this.requestStorageUpdate();
          }
          if (this.useEventDispatcher()) {
            for (const event of this.getProcessStackEndEventList()) {
              this.eventDispatcher.dispatch(event);
            }
          }
          return Promise.resolve({});
        });
    }
    return Promise.resolve();
  }

  onPromiseSuccess(response, caller) {
    if (response !== RESPONSE_FIRST && response !== RESPONSE_STOP && response !== RESPONSE_ERROR) {
      this.pendingPromiseParamsList.shift();
      this.requestStorageUpdate();
    }
    return this.updateStorage().then(() => (caller ? caller() : Promise.resolve()));
  }

  onPromiseError(error) {
    this.handleError(
      error,
      this.pendingPromiseParamsList,
      this.getIndexItem,
      this.setIndexItem,
      this.cancel,
      this.eventDispatcher,
    );
    return Promise.resolve(RESPONSE_ERROR);
  }
}

export default PromiseStackResolver;
