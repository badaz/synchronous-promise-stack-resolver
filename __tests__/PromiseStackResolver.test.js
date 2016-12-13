/* global jest afterEach describe it each expect */

import PromiseStackResolver, {
  STATUS_PROCESSING,
  STATUS_READY,
  STATUS_OFF,
} from '../src/index';
import { PromiseStackResolverError } from '../src/errors';
import * as AsyncStorage from '../test/mock/AsyncStorage';
import EventDispatcher from '../test/mock/EventDispatcher';

const handleError = jest.fn();
const getProcessStackStartEventList = jest.fn(() => []);
const getProcessStackEndEventList = jest.fn(() => []);
const shouldProcessStack = jest.fn(() => true);
const createPromiseCaller = jest.fn(() => () => Promise.resolve());

const getDefaultConfig = () => {
  const config = {
    pendingPromiseParamsListKey: 'pending_promise_params_list',
    secondaryPendingPromiseParamsListKey: 'secondary_pending_promise_params_list',
    storeIndex: true,
    indexKey: 'revision_index',
    useEventDispatcher: true,
    useAsyncStorage: true,
    getProcessStackStartEventList,
    getProcessStackEndEventList,
    shouldProcessStack,
    handleError,
    createPromiseCaller,
    updateAsyncStorageIntervalLength: 3000,
    processPromiseStackIntervalLength: 3000,
  };
  return config;
};

const getMinimalConfig = () => {
  const config = {
    createPromiseCaller,
  };
  return config;
};

const getFailingPromiseConfig = () => {
  const config = getDefaultConfig();
  config.createPromiseCaller = jest.fn(() => () => Promise.reject());
  return config;
};

const getFailingPromiseWithShiftingHandleErrorConfig = () => {
  const config = getDefaultConfig();
  config.createPromiseCaller = jest.fn(() => () => Promise.reject());
  config.handleError = jest.fn(
    (error,
      pendingPromiseParamsList,
      getIndexItem,
      setIndexItem,
      cancel,
      eventDispatcher) => pendingPromiseParamsList.shift(),
  );
  return config;
};

const getFailingPromiseWithStatusModifyingHandleErrorConfig = () => {
  const config = getDefaultConfig();
  config.createPromiseCaller = jest.fn(() => () => Promise.reject());
  config.handleError = jest.fn(
    (error,
      pendingPromiseParamsList,
      getIndexItem,
      setIndexItem,
      cancel,
      eventDispatcher) => 'default')
    .mockImplementationOnce(
      (error,
        pendingPromiseParamsList,
        getIndexItem,
        setIndexItem,
        cancel,
        eventDispatcher) => {
        pendingPromiseParamsList.shift();
        cancel();
      },
    )
  ;
  return config;
};

const getNoEventDispatcherConfig = () => {
  const config = getDefaultConfig();
  config.useEventDispatcher = false;
  return config;
};

const getNoAsyncStorageConfig = () => {
  const config = getDefaultConfig();
  config.useAsyncStorage = false;
  return config;
};

const getNotProcessingConfig = () => {
  const config = getDefaultConfig();
  config.shouldProcessStack = jest.fn(() => false);
  return config;
};

const getEventDispatchingConfig = (startEventList, endEventList) => {
  const config = getDefaultConfig();
  config.getProcessStackStartEventList = () => startEventList;
  config.getProcessStackEndEventList = () => endEventList;
  return config;
};

const getWrongProcessPromiseStackIntervalLengthConfig = () => {
  const faultyConfig = getDefaultConfig();
  faultyConfig.processPromiseStackIntervalLength = 'test';
  return faultyConfig;
};

const getWrongUpdateAsyncStorageIntervalLengthConfig = () => {
  const faultyConfig = getDefaultConfig();
  faultyConfig.updateAsyncStorageIntervalLength = 'test';
  return faultyConfig;
};

const getNoPendingPromiseParamsListKeyConfig = () => {
  const faultyConfig = getDefaultConfig();
  faultyConfig.pendingPromiseParamsListKey = undefined;
  return faultyConfig;
};

const getNoSecondaryPendingPromiseParamsListKeyConfig = () => {
  const faultyConfig = getDefaultConfig();
  faultyConfig.secondaryPendingPromiseParamsListKey = undefined;
  return faultyConfig;
};

const getWrongTypeForPendingPromiseParamsListKeyConfig = () => {
  const faultyConfig = getDefaultConfig();
  faultyConfig.pendingPromiseParamsListKey = () => true;
  return faultyConfig;
};

const getWrongTypeForSecondaryPendingPromiseParamsListKeyConfig = () => {
  const faultyConfig = getDefaultConfig();
  faultyConfig.secondaryPendingPromiseParamsListKey = () => true;
  return faultyConfig;
};

const getWrongTypeForIndexKeyConfig = () => {
  const faultyConfig = getDefaultConfig();
  faultyConfig.indexKey = () => true;
  return faultyConfig;
};

const getNoIndexKeyConfig = () => {
  const faultyConfig = getDefaultConfig();
  faultyConfig.indexKey = undefined;
  return faultyConfig;
};

afterEach(() => {
  handleError.mockClear();
  getProcessStackStartEventList.mockClear();
  getProcessStackEndEventList.mockClear();
  shouldProcessStack.mockClear();
  createPromiseCaller.mockClear();
  return AsyncStorage.clear();
});

describe('SynchronousPromiseStackResolver constructor', () => {
  it('succeeds with no args', () => {
    const promiseStackResolver = new PromiseStackResolver();
    expect(promiseStackResolver).toBeInstanceOf(PromiseStackResolver);
    expect(promiseStackResolver.getStatus()).toBe(STATUS_OFF);
    expect(promiseStackResolver.isProcessing()).toBeFalsy();
    expect(promiseStackResolver.getStackSize()).toBe(0);
    expect(promiseStackResolver.getSecondaryStackSize()).toBe(0);
  });
  it('succeeds with async storage implementation', () => {
    const promiseStackResolver = new PromiseStackResolver(AsyncStorage);
    expect(promiseStackResolver).toBeInstanceOf(PromiseStackResolver);
    expect(promiseStackResolver.getStatus()).toBe(STATUS_OFF);
    expect(promiseStackResolver.isProcessing()).toBeFalsy();
    expect(promiseStackResolver.getStackSize()).toBe(0);
    expect(promiseStackResolver.getSecondaryStackSize()).toBe(0);
  });
  it('succeeds with event dispatcher implementation', () => {
    const eventDispatcher = new EventDispatcher();
    const promiseStackResolver = new PromiseStackResolver(null, eventDispatcher);
    expect(promiseStackResolver).toBeInstanceOf(PromiseStackResolver);
    expect(promiseStackResolver.getStatus()).toBe(STATUS_OFF);
    expect(promiseStackResolver.isProcessing()).toBeFalsy();
    expect(promiseStackResolver.getStackSize()).toBe(0);
    expect(promiseStackResolver.getSecondaryStackSize()).toBe(0);
  });
  it('succeeds with async storage and event dispatcher implementation', () => {
    const eventDispatcher = new EventDispatcher();
    const promiseStackResolver = new PromiseStackResolver(AsyncStorage, eventDispatcher);
    expect(promiseStackResolver).toBeInstanceOf(PromiseStackResolver);
    expect(promiseStackResolver.getStatus()).toBe(STATUS_OFF);
    expect(promiseStackResolver.isProcessing()).toBeFalsy();
    expect(promiseStackResolver.getStackSize()).toBe(0);
    expect(promiseStackResolver.getSecondaryStackSize()).toBe(0);
  });
});

describe('SynchronousPromiseStackResolver initialization', () => {
  it('fails with no config', () => {
    const promiseStackResolver = new PromiseStackResolver();
    expect(() => promiseStackResolver.init()).toThrowError(PromiseStackResolverError);
    expect(() => promiseStackResolver.init()).toThrowError('config is required');
  });
  it('fails if config has wrong processPromiseStackIntervalLength type', () => {
    const promiseStackResolver = new PromiseStackResolver();
    expect(() => promiseStackResolver
      .init(getWrongProcessPromiseStackIntervalLengthConfig()))
      .toThrowError(PromiseStackResolverError)
    ;
    expect(() => promiseStackResolver
      .init(getWrongProcessPromiseStackIntervalLengthConfig()))
      .toThrowError('processPromiseStackIntervalLength must be a number')
    ;
  });
  it('fails if config has updateAsyncStorageIntervalLength and wrong updateAsyncStorageIntervalLength type', () => {
    const promiseStackResolver = new PromiseStackResolver();
    expect(() => promiseStackResolver
      .init(getWrongUpdateAsyncStorageIntervalLengthConfig()))
      .toThrowError(PromiseStackResolverError)
    ;
    expect(() => promiseStackResolver
      .init(getWrongUpdateAsyncStorageIntervalLengthConfig()))
      .toThrowError('updateAsyncStorageIntervalLength must be a number')
    ;
  });

  it('fails if config has updateAsyncStorageIntervalLength and wrong updateAsyncStorageIntervalLength type', () => {
    const promiseStackResolver = new PromiseStackResolver();
    expect(() => promiseStackResolver
      .init(getWrongUpdateAsyncStorageIntervalLengthConfig()))
      .toThrowError(PromiseStackResolverError)
    ;
    expect(() => promiseStackResolver
      .init(getWrongUpdateAsyncStorageIntervalLengthConfig()))
      .toThrowError('updateAsyncStorageIntervalLength must be a number')
    ;
  });
  it('fails if config has wrong type for or no pendingPromiseParamsListKey', () => {
    const promiseStackResolver = new PromiseStackResolver(AsyncStorage, new EventDispatcher());

    expect(() => promiseStackResolver
      .init(getNoPendingPromiseParamsListKeyConfig()))
      .toThrowError(PromiseStackResolverError)
    ;
    expect(() => promiseStackResolver
      .init(getNoPendingPromiseParamsListKeyConfig()))
      .toThrowError('useAsyncStorage is enabled, you must provide pendingPromiseParamsListKey and secondaryPendingPromiseParamsListKey as strings')
    ;

    expect(() => promiseStackResolver
      .init(getNoSecondaryPendingPromiseParamsListKeyConfig()))
      .toThrowError(PromiseStackResolverError)
    ;
    expect(() => promiseStackResolver
      .init(getNoSecondaryPendingPromiseParamsListKeyConfig()))
      .toThrowError('useAsyncStorage is enabled, you must provide pendingPromiseParamsListKey and secondaryPendingPromiseParamsListKey as strings')
    ;

    expect(() => promiseStackResolver
      .init(getWrongTypeForPendingPromiseParamsListKeyConfig()))
      .toThrowError(PromiseStackResolverError)
    ;
    expect(() => promiseStackResolver
      .init(getWrongTypeForPendingPromiseParamsListKeyConfig()))
      .toThrowError('useAsyncStorage is enabled, you must provide pendingPromiseParamsListKey and secondaryPendingPromiseParamsListKey as strings')
    ;

    expect(() => promiseStackResolver
      .init(getWrongTypeForSecondaryPendingPromiseParamsListKeyConfig()))
      .toThrowError(PromiseStackResolverError)
    ;
    expect(() => promiseStackResolver
      .init(getWrongTypeForSecondaryPendingPromiseParamsListKeyConfig()))
      .toThrowError('useAsyncStorage is enabled, you must provide pendingPromiseParamsListKey and secondaryPendingPromiseParamsListKey as strings')
    ;
  });

  it('fails if config has storeIndex enabled and wrong type for or no indexKey', () => {
    const promiseStackResolver = new PromiseStackResolver(AsyncStorage, new EventDispatcher());

    expect(() => promiseStackResolver
      .init(getWrongTypeForIndexKeyConfig()))
      .toThrowError(PromiseStackResolverError)
    ;
    expect(() => promiseStackResolver
      .init(getWrongTypeForIndexKeyConfig()))
      .toThrowError('useAsyncStorage and storeIndex are enabled, you must provide indexKey as string')
    ;

    expect(() => promiseStackResolver
      .init(getNoIndexKeyConfig()))
      .toThrowError(PromiseStackResolverError)
    ;
    expect(() => promiseStackResolver
      .init(getNoIndexKeyConfig()))
      .toThrowError('useAsyncStorage and storeIndex are enabled, you must provide indexKey as string')
    ;
  });

  it('fails if config has useEventDispatcher enabled and no eventDispatcher instance was provided to contruct', () => {
    const promiseStackResolver = new PromiseStackResolver(AsyncStorage);

    expect(() => promiseStackResolver
      .init(getDefaultConfig()))
      .toThrowError(PromiseStackResolverError)
    ;
    expect(() => promiseStackResolver
      .init(getDefaultConfig()))
      .toThrowError('useEventDispatcher is enabled, but you did not provide an eventDispatcher')
    ;
  });

  it('fails if config has useStorageManager enabled and no storageManager instance was provided to contruct', () => {
    const promiseStackResolver = new PromiseStackResolver();

    expect(() => promiseStackResolver
      .init(getDefaultConfig()))
      .toThrowError(PromiseStackResolverError)
    ;
    expect(() => promiseStackResolver
      .init(getDefaultConfig()))
      .toThrowError('useAsyncStorage is enabled but no asyncStorageManager is present')
    ;
  });

  it('succeeds with minimal config', () => {
    const eventDispatcher = new EventDispatcher();
    const promiseStackResolver = new PromiseStackResolver(AsyncStorage, eventDispatcher);
    return promiseStackResolver.init(getMinimalConfig())
      .then(() => {
        expect(promiseStackResolver.getStatus()).toBe(STATUS_READY);
        expect(promiseStackResolver.useAsyncStorage()).toBeFalsy();
        expect(promiseStackResolver.storeIndex()).toBeFalsy();
        expect(promiseStackResolver.useEventDispatcher()).toBeFalsy();
      })
    ;
  });

  it('succeeds with full config', () => {
    const eventDispatcher = new EventDispatcher();
    const promiseStackResolver = new PromiseStackResolver(AsyncStorage, eventDispatcher);
    return promiseStackResolver.init(getDefaultConfig())
      .then(() => {
        expect(promiseStackResolver.getStatus()).toBe(STATUS_READY);
        expect(promiseStackResolver.useAsyncStorage()).toBeTruthy();
        expect(promiseStackResolver.storeIndex()).toBeTruthy();
        expect(promiseStackResolver.useEventDispatcher()).toBeTruthy();
      })
    ;
  });

  it('succeeds with no EventDispatcher config', () => {
    const promiseStackResolver = new PromiseStackResolver(AsyncStorage);
    return promiseStackResolver.init(getNoEventDispatcherConfig())
      .then(() => {
        expect(promiseStackResolver.getStatus()).toBe(STATUS_READY);
        expect(promiseStackResolver.useAsyncStorage()).toBeTruthy();
        expect(promiseStackResolver.storeIndex()).toBeTruthy();
        expect(promiseStackResolver.useEventDispatcher()).toBeFalsy();
      })
    ;
  });

  it('succeeds with no AsyncStorage config', () => {
    const promiseStackResolver = new PromiseStackResolver(null, new EventDispatcher());
    return promiseStackResolver.init(getNoAsyncStorageConfig())
      .then(() => {
        expect(promiseStackResolver.getStatus()).toBe(STATUS_READY);
        expect(promiseStackResolver.useAsyncStorage()).toBeFalsy();
        expect(promiseStackResolver.storeIndex()).toBeFalsy();
        expect(promiseStackResolver.useEventDispatcher()).toBeTruthy();
      })
    ;
  });
});

describe('SynchronousPromiseStackResolver start method', () => {
  it('should instantiate processPromiseStackInterval', () => {
    const promiseStackResolver = new PromiseStackResolver(AsyncStorage, new EventDispatcher());
    return promiseStackResolver.init(getDefaultConfig())
      .then(() => {
        return promiseStackResolver.start()
          .then(() => {
            expect(promiseStackResolver.processPromiseStackInterval).toBeTruthy();
          });
      });
  });
  it('should instantiate updateStorageInterval if useAsyncStorage is true', () => {
    const promiseStackResolver = new PromiseStackResolver(AsyncStorage, new EventDispatcher());
    return promiseStackResolver.init(getDefaultConfig())
      .then(() => {
        return promiseStackResolver.start()
          .then(() => {
            expect(promiseStackResolver.updateStorageInterval).toBeTruthy();
          });
      });
  });
  it('should NOT instantiate updateStorageInterval nor processPromiseStackInterval if not set in config', () => {
    const promiseStackResolver = new PromiseStackResolver();
    return promiseStackResolver.init(getMinimalConfig())
      .then(() => {
        return promiseStackResolver.start()
          .then(() => {
            expect(promiseStackResolver.updateStorageInterval).toBeFalsy();
            expect(promiseStackResolver.processPromiseStackInterval).toBeFalsy();
          });
      });
  });
});

describe('SynchronousPromiseStackResolver stop method', () => {
  it('should delete intervals and set status to off', () => {
    const promiseStackResolver = new PromiseStackResolver(AsyncStorage, new EventDispatcher());
    return promiseStackResolver.init(getDefaultConfig())
      .then(() => {
        return promiseStackResolver.start()
          .then(() => {
            return promiseStackResolver.stop()
              .then(() => {
                expect(promiseStackResolver.processPromiseStackInterval).toBeFalsy();
                expect(promiseStackResolver.updateStorageInterval).toBeFalsy();
                expect(promiseStackResolver.getStatus()).toBe('off');
              });
          });
      });
  });
});

describe('SynchronousPromiseStackResolver addItem method', () => {
  it('should increase stack size', () => {
    const promiseStackResolver = new PromiseStackResolver(AsyncStorage, new EventDispatcher());
    return promiseStackResolver.init(getDefaultConfig())
      .then(() => {
        promiseStackResolver.addItem({});
        expect(promiseStackResolver.getStackSize()).toBe(1);
        promiseStackResolver.addItem({});
        expect(promiseStackResolver.getStackSize()).toBe(2);
      });
  });
  it('should increase secondary stack size if status is not ready', () => {
    const promiseStackResolver = new PromiseStackResolver(AsyncStorage, new EventDispatcher());
    return promiseStackResolver.init(getDefaultConfig())
      .then(() => {
        promiseStackResolver.status = STATUS_PROCESSING;
        promiseStackResolver.addItem({});
        expect(promiseStackResolver.getSecondaryStackSize()).toBe(1);
        promiseStackResolver.addItem({});
        expect(promiseStackResolver.getSecondaryStackSize()).toBe(2);
      });
  });
});

describe('SynchronousPromiseStackResolver processStack method', () => {
  it('should empty stack on complete if secondary stack was empty', () => {
    const promiseStackResolver = new PromiseStackResolver(AsyncStorage, new EventDispatcher());
    return promiseStackResolver.init(getDefaultConfig())
      .then(() => {
        promiseStackResolver.addItem({});
        expect(promiseStackResolver.getStackSize()).toBe(1);
        promiseStackResolver.addItem({});
        expect(promiseStackResolver.getStackSize()).toBe(2);
        return promiseStackResolver.processPromiseStack()
          .then(() => {
            expect(promiseStackResolver.getStackSize()).toBe(0);
          });
      });
  });
});

describe('SynchronousPromiseStackResolver processStack method', () => {
  it('should merge secondaryStack into first stack after resolving first stack', () => {
    const promiseStackResolver = new PromiseStackResolver(AsyncStorage, new EventDispatcher());
    return promiseStackResolver.init(getDefaultConfig())
      .then(() => {
        promiseStackResolver.addItem({});
        expect(promiseStackResolver.getStackSize()).toBe(1);
        promiseStackResolver.status = STATUS_PROCESSING;
        promiseStackResolver.addItem({});
        promiseStackResolver.addItem({});
        expect(promiseStackResolver.getSecondaryStackSize()).toBe(2);
        promiseStackResolver.status = STATUS_READY;
        return promiseStackResolver.processPromiseStack()
          .then(() => {
            expect(promiseStackResolver.getStackSize()).toBe(2);
            expect(promiseStackResolver.getSecondaryStackSize()).toBe(0);
          });
      });
  });

  it('should call handleError provided function on Promise rejection and stack should not be shifted', () => {
    const promiseStackResolver = new PromiseStackResolver(AsyncStorage, new EventDispatcher());
    return promiseStackResolver.init(getFailingPromiseConfig())
      .then(() => {
        promiseStackResolver.addItem({});
        expect(promiseStackResolver.getStackSize()).toBe(1);
        return promiseStackResolver.processPromiseStack()
          .then(() => {
            expect(handleError).toBeCalled();
            expect(promiseStackResolver.getStackSize()).toBe(1);
          });
      });
  });

  it('should call handleError provided function N times on multiple Promise rejection and stack should not be shifted', () => {
    const promiseStackResolver = new PromiseStackResolver(AsyncStorage, new EventDispatcher());
    return promiseStackResolver.init(getFailingPromiseConfig())
      .then(() => {
        promiseStackResolver.addItem({});
        promiseStackResolver.addItem({});
        expect(promiseStackResolver.getStackSize()).toBe(2);
        return promiseStackResolver.processPromiseStack()
          .then(() => {
            expect(handleError).toBeCalled();
            expect(promiseStackResolver.getStackSize()).toBe(2);
          });
      });
  });
});

describe('handleError method', () => {
  it('can access and alter pendingPromiseParamsStack', () => {
    const promiseStackResolver = new PromiseStackResolver(AsyncStorage, new EventDispatcher());
    const config = getFailingPromiseWithShiftingHandleErrorConfig();
    return promiseStackResolver.init(config)
      .then(() => {
        promiseStackResolver.addItem({});
        promiseStackResolver.addItem({});
        expect(promiseStackResolver.getStackSize()).toBe(2);
        return promiseStackResolver.processPromiseStack()
          .then(() => {
            expect(config.handleError).toBeCalled();
            expect(promiseStackResolver.getStackSize()).toBe(0);
          });
      });
  });
  it('can call cancel', () => {
    const promiseStackResolver = new PromiseStackResolver(AsyncStorage, new EventDispatcher());
    const config = getFailingPromiseWithStatusModifyingHandleErrorConfig();
    return promiseStackResolver.init(config)
      .then(() => {
        promiseStackResolver.addItem({});
        promiseStackResolver.addItem({});
        expect(promiseStackResolver.getStackSize()).toBe(2);
        return promiseStackResolver.processPromiseStack()
          .then(() => {
            expect(config.handleError).toBeCalled();
            expect(config.handleError.mock.instances.length).toBe(2);
            expect(promiseStackResolver.getStackSize()).toBe(1);
          });
      });
  });
});

describe('shouldProcessStack method', () => {
  it('should prevent processing stack if it returns false', () => {
    const promiseStackResolver = new PromiseStackResolver(AsyncStorage, new EventDispatcher());
    const config = getNotProcessingConfig();
    return promiseStackResolver.init(config)
      .then(() => {
        promiseStackResolver.addItem({});
        promiseStackResolver.addItem({});
        expect(promiseStackResolver.getStackSize()).toBe(2);
        return promiseStackResolver.processPromiseStack()
          .then(() => {
            expect(config.handleError).not.toBeCalled();
            expect(promiseStackResolver.getStackSize()).toBe(2);
          });
      });
  });
});

describe('eventDispatcher', () => {
  it('should dispatch events on start and end processing when provided', () => {
    const event1 = {};
    const event2 = {};
    const event3 = {};
    const event4 = {};
    const startEventList = [event1, event2];
    const endEventList = [event3, event4];
    const eventDispatcher = new EventDispatcher();
    eventDispatcher.dispatch = jest.fn(() => true);
    const promiseStackResolver = new PromiseStackResolver(AsyncStorage, eventDispatcher);
    const config = getEventDispatchingConfig(startEventList, endEventList);
    return promiseStackResolver.init(config)
      .then(() => {
        promiseStackResolver.addItem({});
        promiseStackResolver.addItem({});
        expect(promiseStackResolver.getStackSize()).toBe(2);
        return promiseStackResolver.processPromiseStack()
          .then(() => {
            expect(promiseStackResolver.getStackSize()).toBe(0);
            expect(eventDispatcher.dispatch).toBeCalled();
            expect(eventDispatcher.dispatch.mock.calls[0][0]).toBe(event1);
            expect(eventDispatcher.dispatch.mock.calls[1][0]).toBe(event2);
            expect(eventDispatcher.dispatch.mock.calls[2][0]).toBe(event3);
            expect(eventDispatcher.dispatch.mock.calls[3][0]).toBe(event4);
          });
      });
  });
});
