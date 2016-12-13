Synchronous Promise Stack Resolver
===================================
Synchronously resolves promises using react native's AsyncStorage (tested) or LocalForage (not tested) for data persistence if needed and any kind of event dispatcher

## Installation
```
npm install --save synchronous-promise-stack-resolver
```
## What's the purpose of this package ?
Initially, this package was built for a personal purpose. I was building an offline first React Native app and wanted to synchrnoize user data to a server. On each user CRUD action I had to store the parameters of the action and replay them as POST, PUT, DELETE requests later on in the same order as they came in the first place. I also had to handle each response differently according to its nature or status code. Additionaly I also needed to send events before and after everything was resolved.

## How does it work ?
Once configured and initialized, the PromiseStackResolver can be used in different ways. You can either call start() and it will try to resolve everything it has in its stack (gotten from storage or memory) on every tick (see configuration section), or you can just call processStack whenever you need. You add the params for a promise using addItem(item) and the promise is created using the createPromiseCaller function you provide via the configuration object. You also have to provide an handleError function if you want to take specific action in case of Promise rejection.

## Configuration
### Constructor
The PromiseStackResolver's constructor optionnaly takes an implementation of asynchronous storage as first argument (React Native's AsyncStorage or browser's LocalForage) that must implement async methods getItem, setItem and removeItem. As a second argument you may provide an event dispatcher of your choice that must implement a dispatch method.

### Configuration
The init method takes an object as only argument which must contain some configuration data, here is the list:
- createPromiseCaller (optional): `function` returning `function` that returns a Promise object (see below),
- useEventDispatcher (optional): `boolean`,
- useAsyncStorage (optional): `boolean`,
- storeIndex (optional): `boolean`,
- pendingPromiseParamsListKey (optional): `string`,
- secondaryPendingPromiseParamsListKey (optional): `string`,
- indexKey (optional): `string`,
- updateAsyncStorageIntervalLength (optional) : `number` (milliseconds),
- processPromiseStackIntervalLength (optional): `number` (milliseconds),
- getProcessStackStartEventList (optional): `function` returning array of event objects to be dispatched by the eventDispatcher provided to the constructor
- getProcessStackEndEventList (optional): `function` returning array of event objects to be dispatched by the eventDispatcher provided to the constructor
- shouldProcessStack (optional): `function` returning boolean
- handleError (optional): `function` returning Promise

Every param is optional, but if you do not pass at least a createPromiseCaller function your PromiseStackResolver will just not do anything, it will resolve empty promises if there are items in the stack and processStack is called and that's all.

`boolean` keys are used to specify if you wish to use specific functionality, for example if useEventDispatcher is set to true, the processStack method will trigger all the events contained in the array returned by the getProcessStackStartEventList provided function when it starts, and all the events contained in the array returned by the getProcessStackEndEventList provided function when it ends. It will not work if you did not provide an eventDispatcher at construct.

Following the same idea, useAsyncStorage will persist pendingPromise params into storage to be able to take back where it stopped on next launch of your app. useAsyncStorage requires that you provided an async storage implementation at contruct and pendingPromiseParamsListKey and secondaryPendingPromiseParamsListKey params in config.

storeIndex will persist an index that you can access in createPromiseCaller function as well as handleError, it will be enabled only if you provide an indexKey as well and you have provided an implementation of async storage at contruct.

`string` keys are used for storage and can be anything. Usually you will want to make them unique if you're persisting things for multiple users for example.

`number` keys are used to set intervals, one for processRequestStack, one for updateAsyncStorage so that it calls these functions every N milliseconds. (NB updateAsyncStorage is also called after every resolved promise)

`createPromiseCaller(pendingPromiseParams, getIndexItem, setIndexItem, eventDispatcher)`: this function is called to create a promise caller function for each item stored in the stack. It takes arguments that you might want to use to return your promise. The pendingPromiseParams is used to return a specific promise caller, the get/setIndexItem methods are used to keep and use things from a custom index (js object) during processStack (example: revision number of an updated entity since when you saved it into params it might have had an old revision number, see example below). The eventDispatcher is there in case you might want to dispatch specific events.

`handleError(error, pendingPromiseParamsList, getIndexItem, setIndexItem, cancel, eventDispatcher)`: this function is called upon error (aka promise rejection), it takes the error as first argument so you can take action according to its type. pendingPromiseParamsList in case you might need to update it, get/setIndexItem (see above), cancel which is a function that will cancel all following promises (but not unstack them) and eventDispatcher in case you might want to dispatch specific events.

## Helper methods
A number of helper methods are available on the instance of PromiseStackResolver:

- isSynced(): returns true if when processing is finished and stack is empty
- getStackSize(): returns the number of items contained in pendingPromiseParamsList
- getSecondaryStackSize(): returns the number of items contained in secondaryPendingPromiseParamsList (this secondaryStack is used when addItem(item) is called while processStack is running, it is merged in normal stack after processStack is finished)
- getLastProcessingErrorCount(): returns the count of errors found during last call to processStack
- getLastProcessingErrorList: returns an array of the errors found during last call to processStack
- stop(): stops the automatic calls to processStack and updateAsyncStorage end releases resources
- isProcessing(): returns a boolean indicating if processStack is actually running or not
- clearStorage(): removes all data contained in storage corresponding to config's keys
- getStatus(): returns the status of the PromiseStackResolver
- requestStorageUpdate(): request updating storage next time updateAsyncStorage is called
- revokeStorageUpdate(): revoke updating storage next time updateAsyncStorage is called

## Example
```javascript
const createPromiseCaller = (
  pendingPromiseParams, // this contains the object you passed to addItem
  getIndexItem,
  setIndexItem,
  eventDispatcher
) => {
  // let's assume your pendingPromiseParams has a type prop
  switch (pendingPromiseParams.type) {
    case 'POST':
      // retrun a function that returns a promise
      return () => {
        // dispatch any kind of event
        const beforePostEvent = {};
        eventDispatcher.dispatch(beforePostEvent);
        // let's assume your pendingPromiseParams has a url prop and a body props
        return request.post(pendingPromiseParams.url, pendingPromiseParams.body)
          .then(response => response.json())
          .then(responseBody => {
            // let's assume your responseBody has an id and a rev props
            // and you want to keep track of the rev to update the same entity later
            setIndexItem(responseBody.id, responseBody.rev);
            // dispatch any kind of event
            const afterPostEvent = {};
            eventDispatcher.dispatch(afterPostEvent);
            return responseBody;
          });
    }
    case 'PUT':
      return () => {
        const beforePutEvent = {};
        eventDispatcher.dispatch(beforePutEvent);
        // get the currentRev from the index
        const currentRev = getIndex(pendingPromiseParams.body.id);
        if (currentRev && pendingPromiseParams.body.rev < currentRev) {
          // update entity with current rev
          pendingPromiseParams.body.rev = currentRev;
        }
        return request.put(pendingPromiseParams.url, pendingPromiseParams.body)
          .then(response => response.json())
          .then(responseBody => {
            setIndexItem(responseBody.id, responseBody.rev);
            const afterPutEvent = {};
            eventDispatcher.dispatch(afterPutEvent);
            return responseBody;
          })
        ;
      }
    default:
      return () => Promise.resolve();
  }
}

const handleError = (
  error,
  pendingPromiseParamsList,
  getIndexItem,
  setIndexItem,
  cancel,
  eventDispatcher
) => {
  switch (error.name) {
    case 'BadRequestError':
    case 'AccessDeniedError':
    case 'ResourceNotFoundError':
    case 'MethodNotAllowedError':
    case 'ConflictError':
      const errorEvent = {};
      eventDispatcher.dispatch(errorEvent);
      pendingPromiseParamsList.shift();
      break;
    case 'NoNetworkError':
    case 'TypeError':
    case 'BadGatewayError':
    case 'InternalServerError':
    case 'ServiceUnavailableError':
    case 'GatewayTimeoutError':
    default:
      const cancelEvent = {};
      eventDispatcher.dispatch(errorEvent);
      cancel();
      break;
  }
}

const config = {
  storeIndex: true,
  useEventDispatcher: true,
  useAsyncStorage: true,
  pendingPromiseParamsListKey: 'pending_promise_params_list',
  secondaryPendingPromiseParamsListKey: 'secondary_pending_promise_params_list',
  indexKey: 'revision_index',
  updateAsyncStorageIntervalLength: 3000,
  processPromiseStackIntervalLength: 3000,
  getProcessStackStartEventList: () => [{}, {}], // any events
  getProcessStackEndEventList: () => [{}, {}, {}], // any events
  shouldProcessStack: () => true, // any function, if it returns true processStack will proceed
  handleError,
  createPromiseCaller,
}

const promiseStackResolverInstance = new PromiseStackResolver(anyAsyncStorage, anyEventDispatcher);
promiseStackResolverInstance.init(config) // initialize with config object
  .then(() => {
    promiseStackResolverInstance.start() // start will set the intervals to processStack and updateAsyncStorage
      .then(() => {
        let entity = { id: 1, rev: 0, name: 'foo' }; // create an entity
        // add POST entity to stack
        promiseStackResolverInstance.addItem({ type: 'POST', url: 'https://api.example.com/entity', body: entity});
        entity.name = 'bar'; // update same entity
        // add PUT entity to stack
        promiseStackResolverInstance.addItem({ type: 'PUT', url: 'https://api.example.com/entity', body: entity});
      })
  })
;
```