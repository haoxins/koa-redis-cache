'use strict'

const request = require('supertest')
const should = require('should')
const cache = require('..')
const koa = require('koa')

describe('## options - prefix', () => {
  describe('# old prefix', () => {
    const options = {
      prefix: 'old-koa-redis-cache:'
    }
    let app = koa()
    app.use(cache(options))
    app.use(function* () {
      this.body = {
        name: 'old prefix'
      }
    })

    app = app.listen(3006)

    it('no cache', (done) => {
      request(app)
        .get('/prefix/json')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('application/json; charset=utf-8')
          should.not.exist(res.headers['x-koa-redis-cache'])
          res.body.name.should.equal('old prefix')
          done()
        })
    })

    it('from cache', (done) => {
      request(app)
        .get('/prefix/json')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('application/json; charset=utf-8')
          res.headers['x-koa-redis-cache'].should.equal('true')
          res.body.name.should.equal('old prefix')
          done()
        })
    })
  })

  describe('# new prefix', () => {
    var options = {
      prefix: 'new-koa-redis-cache:'
    }
    var app = koa()
    app.use(cache(options))
    app.use(function* () {
      this.body = {
        name: 'new prefix'
      }
    })

    app = app.listen(3000)

    it('no cache', (done) => {
      request(app)
        .get('/prefix/json')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('application/json; charset=utf-8')
          should.not.exist(res.headers['x-koa-redis-cache'])
          res.body.name.should.equal('new prefix')
          done()
        })
    })

    it('from cache', (done) => {
      request(app)
        .get('/prefix/json')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('application/json; charset=utf-8')
          res.headers['x-koa-redis-cache'].should.equal('true')
          res.body.name.should.equal('new prefix')
          done()
        })
    })
  })

  describe('# dynamic prefix', () => {
    var options = {
      prefix: function(ctx) {
        // You won't actually want to directly use user-supplied parameters in cache keys for security reasons
        return 'dynamic-prefix-user-' + ctx.request.header['x-user'] + '-koa-redis-cache:'
      }
    }
    var app = koa()
    app.use(cache(options))
    app.use(function* () {
      this.body = {
        name: 'dynamic prefix user ' + this.request.header['x-user']
      }
    })

    app = app.listen(3011)

    it('no cache prefix 1', (done) => {
      request(app)
        .get('/prefix/json')
        .set('X-User', 'one')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('application/json; charset=utf-8')
          should.not.exist(res.headers['x-koa-redis-cache'])
          res.body.name.should.equal('dynamic prefix user one')
          done()
        })
    })

    it('from cache prefix 1', (done) => {
      request(app)
        .get('/prefix/json')
        .set('X-User', 'one')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('application/json; charset=utf-8')
          res.headers['x-koa-redis-cache'].should.equal('true')
          res.body.name.should.equal('dynamic prefix user one')
          done()
        })
    })

    it('no cache prefix 2', (done) => {
      request(app)
        .get('/prefix/json')
        .set('X-User', 'two')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('application/json; charset=utf-8')
          should.not.exist(res.headers['x-koa-redis-cache'])
          res.body.name.should.equal('dynamic prefix user two')
          done()
        })
    })

    it('from cache prefix 2', (done) => {
      request(app)
        .get('/prefix/json')
        .set('X-User', 'two')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('application/json; charset=utf-8')
          res.headers['x-koa-redis-cache'].should.equal('true')
          res.body.name.should.equal('dynamic prefix user two')
          done()
        })
    })
  })
})
