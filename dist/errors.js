'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
function PromiseStackResolverError(message) {
  this.name = 'PromiseStackResolverError';
  this.message = message || 'Promise Stack Resolver Error';
  this.stack = new Error().stack;
}
PromiseStackResolverError.prototype = Object.create(Error.prototype);
PromiseStackResolverError.prototype.constructor = PromiseStackResolverError;

exports.default = PromiseStackResolverError;