let cache = {};

function cb(fn = () => {}, err, res) {
  return new Promise((resolve, reject) => {
    fn(err, res);
    if (err) {
      return reject(err);
    }
    return resolve(res);
  });
}

function error(msg) {
  return new Error(msg);
}

export async function getItem(key, callback) {
  if (cache[key]) {
    return cb(callback, null, cache[key]);
  }
  return cb(callback, undefined);
}

export async function setItem(key, value, callback) {
  cache[key] = value;
  return cb(callback);
}

export async function removeItem(key, callback) {
  if (cache[key]) {
    delete cache[key];
    return cb(callback);
  }
  return cb(callback, error('no such key'));
}

export async function clear(callback) {
  cache = {};
  return cb(callback);
}
