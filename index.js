'use strict';

var pathToRegExp = require('path-to-regexp'),
  wrapper = require('co-redis'),
  readall = require('readall'),
  Redis = require('redis');

module.exports = function(options) {
  options = options || {};
  var redisAvailable = false,
    redisOptions = options.redis || {},
    prefix = options.prefix || 'koa-redis-cache:',
    expire = options.expire || 30 * 60, // 30 min
    routes = options.routes || ['(.*)'],
    exclude = options.exclude || [],
    passParam = options.passParam || '',
    maxLength = options.maxLength || Infinity,
    onerror = options.onerror || function() {};

  /**
   * redisClient
   */
  redisOptions.port = redisOptions.port || 6379;
  redisOptions.host = redisOptions.host || 'localhost';
  var redisClient = wrapper(Redis.createClient(redisOptions.port, redisOptions.host, redisOptions.options));
  redisClient.on('error', function(error) {
    redisAvailable = false;
    onerror(error);
  });
  redisClient.on('end', function() {
    redisAvailable = false;
  });
  redisClient.on('connect', function() {
    redisAvailable = true;
  });

  return function * cache(next) {
    var ctx = this,
      url = ctx.request.url,
      path = ctx.request.path,
      key = prefix + url,
      tkey = key + ':type',
      match = false,
      routeExpire = false;

    for (var i = 0; i < routes.length; i++) {
      var route = routes[i];

      if (typeof routes[i] === 'object') {
        route = routes[i].path;
        routeExpire = routes[i].expire;
      }

      if (paired(route, path)) {
        match = true;
        break;
      }
    }

    for (var j = 0; j < exclude.length; j++) {
      if (paired(exclude[j], path)) {
        match = false;
        break;
      }
    }

    if (!redisAvailable || !match || (passParam && ctx.request.query[passParam])) {
      return yield * next;
    }

    var ok = false;
    try {
      ok = yield getCache(ctx, key, tkey);
    } catch (e) {
      ok = false;
    }
    if (ok) {
      return;
    }

    yield * next;

    try {
      var trueExpire = routeExpire || expire;
      yield setCache(ctx, key, tkey, trueExpire);
    } catch (e) {}
    routeExpire = false;
  };

  /**
   * getCache
   */
  function * getCache(ctx, key, tkey) {
    var value = JSON.parse(yield redisClient.get(key)), 
        type,
        ok = false;

    if (value) {
      ctx.response.status = 200;
      type = (yield redisClient.get(tkey)) || 'text/html';
      ctx.response.set('X-Koa-Redis-Cache', 'true');
      ctx.response.type = type;
      ctx.response.body = value;
      ok = true;
    }

    return ok;
  }

  /**
   * setCache
   */
  function * setCache(ctx, key, tkey, expire) {
    var body = ctx.response.body;

    if ((ctx.request.method !== 'GET') || (ctx.response.status !== 200) || !body) {
      return;
    }

    if (typeof body === 'string') {
      // string
      if (Buffer.byteLength(body) > maxLength) return;
      yield redisClient.setex(key, expire, body);
    } else if (Buffer.isBuffer(body)) {
      // buffer
      if (body.length > maxLength) return;
      yield redisClient.setex(key, expire, body);
    } else if (typeof body === 'object' && ctx.response.type === 'application/json') {
      // json
      body = JSON.stringify(body);
      if (Buffer.byteLength(body) > maxLength) return;
      yield redisClient.setex(key, expire, body);
    } else if (typeof body.pipe === 'function') {
      // stream
      body = yield read(body);
      ctx.response.body = body;
      if (Buffer.byteLength(body) > maxLength) return;
      yield redisClient.setex(key, expire, body);
    } else {
      return;
    }

    yield * cacheType(ctx, tkey, expire);
  }

  /**
   * cacheType
   */
  function * cacheType(ctx, tkey, expire) {
    var type = ctx.response.type;
    if (type) {
      yield redisClient.setex(tkey, expire, type);
    }
  }
};

function paired(route, path) {
  var options = {
    sensitive: true,
    strict: true,
  };

  return pathToRegExp(route, [], options).exec(path);
}

function read(stream) {
  return function(done) {
    readall(stream, done);
  };
}
