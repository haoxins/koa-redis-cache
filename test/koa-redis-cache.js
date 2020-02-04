'use strict'

const request = require('supertest')
const { equal } = require('assert')
const should = require('should')
const cache = require('..')
const Koa = require('koa')

describe('## default options', () => {
  let app = new Koa()
  app.use(cache())
  app.use(async (ctx) => {
    if (ctx.path === '/app/json') {
      ctx.body = {
        name: 'hello'
      }
      return
    }
    if (ctx.path === '/app/text') {
      ctx.body = 'hello'
      return
    }
    if (ctx.path === '/app/type') {
      ctx.body = 'default type: html'
      ctx.res.removeHeader('Content-Type')
    }
    if (ctx.path === '/app/html') {
      ctx.body = '<h1>hello</h1>'
      if (ctx.query.v) {
        ctx.body += ctx.query.v
      }
      return
    }
    if (ctx.path === '/app/buffer') {
      ctx.body = new Buffer('buffer')
      return
    }
    if (ctx.path === '/app/500') {
      ctx.status = 500
      ctx.body = 'no cache'
      return
    }
    if (ctx.path === '/app/something' && ctx.method === 'GET') {
      ctx.body = 'GET response'
      return
    }
    if (ctx.path === '/app/something' && ctx.method === 'PUT') {
      ctx.body = 'PUT response'
      return
    }
  })

  app = app.listen(3001)

  describe('# no cache', () => {
    it('get json', (done) => {
      request(app)
        .get('/app/json')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('application/json; charset=utf-8')
          should.not.exist(res.headers['x-koa-redis-cache'])
          res.body.name.should.equal('hello')
          done()
        })
    })

    it('get text', (done) => {
      request(app)
        .get('/app/text')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('text/plain; charset=utf-8')
          should.not.exist(res.headers['x-koa-redis-cache'])
          equal(res.text, 'hello')
          done()
        })
    })

    it('get type', (done) => {
      request(app)
        .get('/app/type')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          should.not.exist(res.headers['content-type'])
          should.not.exist(res.headers['x-koa-redis-cache'])
          equal(res.text, 'default type: html')
          done()
        })
    })

    it('get html', (done) => {
      request(app)
        .get('/app/html')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('text/html; charset=utf-8')
          should.not.exist(res.headers['x-koa-redis-cache'])
          equal(res.text, '<h1>hello</h1>')
          done()
        })
    })

    it('get buffer', (done) => {
      request(app)
        .get('/app/buffer')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('application/octet-stream')
          should.not.exist(res.headers['x-koa-redis-cache'])
          equal(res.body, 'buffer')
          done()
        })
    })
  })

  describe('# from cache', () => {
    it('get json', (done) => {
      request(app)
        .get('/app/json')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('application/json; charset=utf-8')
          res.headers['x-koa-redis-cache'].should.equal('true')
          res.body.name.should.equal('hello')
          done()
        })
    })

    it('get text', (done) => {
      request(app)
        .get('/app/text')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('text/plain; charset=utf-8')
          res.headers['x-koa-redis-cache'].should.equal('true')
          equal(res.text, 'hello')
          done()
        })
    })

    it('get type', (done) => {
      request(app)
        .get('/app/type')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('text/html; charset=utf-8')
          res.headers['x-koa-redis-cache'].should.equal('true')
          equal(res.text, 'default type: html')
          done()
        })
    })

    it('get html', (done) => {
      request(app)
        .get('/app/html')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('text/html; charset=utf-8')
          res.headers['x-koa-redis-cache'].should.equal('true')
          equal(res.text, '<h1>hello</h1>')
          done()
        })
    })

    it('get buffer', (done) => {
      request(app)
        .get('/app/buffer')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('application/octet-stream')
          res.headers['x-koa-redis-cache'].should.equal('true')
          equal(res.body, 'buffer')
          done()
        })
    })
  })

  describe('# different params', () => {
    it('no cache', (done) => {
      request(app)
        .get('/app/html?v=1')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('text/html; charset=utf-8')
          should.not.exist(res.headers['x-koa-redis-cache'])
          equal(res.text, '<h1>hello</h1>1')
          done()
        })
    })

    it('from cache', (done) => {
      request(app)
        .get('/app/html?v=1')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('text/html; charset=utf-8')
          res.headers['x-koa-redis-cache'].should.equal('true')
          equal(res.text, '<h1>hello</h1>1')
          done()
        })
    })

    it('no cache', (done) => {
      request(app)
        .get('/app/html?v=2')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('text/html; charset=utf-8')
          should.not.exist(res.headers['x-koa-redis-cache'])
          equal(res.text, '<h1>hello</h1>2')
          done()
        })
    })

    it('no cache', (done) => {
      request(app)
        .get('/app/html?v=3')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('text/html; charset=utf-8')
          should.not.exist(res.headers['x-koa-redis-cache'])
          equal(res.text, '<h1>hello</h1>3')
          done()
        })
    })

    it('from cache', (done) => {
      request(app)
        .get('/app/html?v=3')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(200)
          res.headers['content-type'].should.equal('text/html; charset=utf-8')
          res.headers['x-koa-redis-cache'].should.equal('true')
          equal(res.text, '<h1>hello</h1>3')
          done()
        })
    })
  })

  describe('# not 200, no cache', () => {
    it('first: no cache', (done) => {
      request(app)
        .get('/app/500')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(500)
          res.headers['content-type'].should.equal('text/plain; charset=utf-8')
          should.not.exist(res.headers['x-koa-redis-cache'])
          equal(res.text, 'no cache')
          done()
        })
    })

    it('second: no cache', (done) => {
      request(app)
        .get('/app/500')
        .end((err, res) => {
          should.not.exist(err)
          res.status.should.equal(500)
          res.headers['content-type'].should.equal('text/plain; charset=utf-8')
          should.not.exist(res.headers['x-koa-redis-cache'])
          equal(res.text, 'no cache')
          done()
        })
    })
  })

  describe('# not GET, no cache', () => {
    it('no cache for PUT even after GET', (done) => {
      request(app)
        .get('/app/something')
        .end((getErr, getRes) => {
          should.not.exist(getErr)
          getRes.headers['content-type'].should.equal('text/plain; charset=utf-8')
          should.not.exist(getRes.headers['x-koa-redis-cache'])
          equal(getRes.text, 'GET response')

          request(app)
            .put('/app/something')
            .end((putErr, putRes) => {
              should.not.exist(putErr)
              putRes.headers['content-type'].should.equal('text/plain; charset=utf-8')
              should.not.exist(putRes.headers['x-koa-redis-cache'])
              equal(putRes.text, 'PUT response')
              done()
            })
        })
    })
  })
})
