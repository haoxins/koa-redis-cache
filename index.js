
'use strict'

const pathToRegExp = require('path-to-regexp')
const wrapper = require('co-redis')
const readall = require('readall')
const Redis = require('redis')

module.exports = function(options) {
  options = options || {}
  let redisAvailable = false
  let redisOptions = options.redis || {}
  const prefix = options.prefix || 'koa-redis-cache:'
  const expire = options.expire || 30 * 60 // 30 min
  const routes = options.routes || ['(.*)']
  const exclude = options.exclude || []
  const passParam = options.passParam || ''
  const maxLength = options.maxLength || Infinity
  const onerror = options.onerror || function() {}

  /**
   * redisClient
   */
  redisOptions.port = redisOptions.port || 6379
  redisOptions.host = redisOptions.host || 'localhost'
  redisOptions.url = redisOptions.url || 'redis://' + redisOptions.host + ':' + redisOptions.port + '/'
  const redisClient = wrapper(Redis.createClient(redisOptions.url, redisOptions.options))
  redisClient.on('error', (error)=> {
    redisAvailable = false
    onerror(error)
  })
  redisClient.on('end', () => {
    redisAvailable = false
  })
  redisClient.on('connect', () => {
    redisAvailable = true
  })

  return function * cache(next) {
    const ctx = this
    const url = ctx.request.url
    const path = ctx.request.path
    const resolvedPrefix = typeof prefix === 'function' ? prefix.call(ctx, ctx) : prefix;
    const key = resolvedPrefix + url
    const tkey = key + ':type'
    let match = false
    let routeExpire = false

    for (let i = 0; i < routes.length; i++) {
      let route = routes[i]

      if (typeof routes[i] === 'object') {
        route = routes[i].path
        routeExpire = routes[i].expire
      }

      if (paired(route, path)) {
        match = true
        break
      }
    }

    for (let j = 0; j < exclude.length; j++) {
      if (paired(exclude[j], path)) {
        match = false
        break
      }
    }

    if (!redisAvailable || !match || (passParam && ctx.request.query[passParam])) {
      return yield * next
    }

    let ok = false
    try {
      ok = yield getCache(ctx, key, tkey)
    } catch (e) {
      ok = false
    }
    if (ok) {
      return
    }

    yield * next

    try {
      let trueExpire = routeExpire || expire
      yield setCache(ctx, key, tkey, trueExpire)
    } catch (e) {}
    routeExpire = false
  }

  /**
   * getCache
   */
  function * getCache(ctx, key, tkey) {
    let value = yield redisClient.get(key)
    let type
    let ok = false

    if (value) {
      ctx.response.status = 200
      type = (yield redisClient.get(tkey)) || 'text/html'
      ctx.response.set('X-Koa-Redis-Cache', 'true')
      ctx.response.type = type
      ctx.response.body = value
      ok = true
    }

    return ok
  }

  /**
   * setCache
   */
  function * setCache(ctx, key, tkey, expire) {
    let body = ctx.response.body

    if ((ctx.request.method !== 'GET') || (ctx.response.status !== 200) || !body) {
      return
    }

    if (typeof body === 'string') {
      // string
      if (Buffer.byteLength(body) > maxLength) return
      yield redisClient.setex(key, expire, body)
    } else if (Buffer.isBuffer(body)) {
      // buffer
      if (body.length > maxLength) return
      yield redisClient.setex(key, expire, body)
      yield redisClient.setex(tkey, expire, ctx.response.type)
    } else if (typeof body === 'object' && ctx.response.type === 'application/json') {
      // json
      body = JSON.stringify(body)
      if (Buffer.byteLength(body) > maxLength) return
      yield redisClient.setex(key, expire, body)
    } else if (typeof body.pipe === 'function') {
      // stream
      body = yield read(body)
      ctx.response.body = body
      if (Buffer.byteLength(body) > maxLength) return
      yield redisClient.setex(key, expire, body)
    } else {
      return
    }

    yield * cacheType(ctx, tkey, expire)
  }

  /**
   * cacheType
   */
  function * cacheType(ctx, tkey, expire) {
    let type = ctx.response.type
    if (type) {
      yield redisClient.setex(tkey, expire, type)
    }
  }
}

function paired(route, path) {
  let options = {
    sensitive: true,
    strict: true,
  }

  return pathToRegExp(route, [], options).exec(path)
}

function read(stream) {
  return new Promise((resolve, reject) => {
    readall(stream, (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}
