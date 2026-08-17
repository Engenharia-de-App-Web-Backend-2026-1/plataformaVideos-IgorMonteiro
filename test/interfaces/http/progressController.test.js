'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const createProgressController = require('../../../src/interfaces/http/progressController');

function createFakeSubscriber() {
  const emitter = new EventEmitter();
  const subscribeCalls = [];
  const unsubscribeCalls = [];

  emitter.subscribe = (channel) => subscribeCalls.push(channel);
  emitter.unsubscribe = (channel) => unsubscribeCalls.push(channel);
  emitter.subscribeCalls = subscribeCalls;
  emitter.unsubscribeCalls = unsubscribeCalls;

  return emitter;
}

function createFakeReq(id) {
  const req = new EventEmitter();
  req.params = { id };
  return req;
}

function createFakeRes() {
  const writes = [];
  return {
    writes,
    headers: null,
    set(headers) {
      this.headers = headers;
    },
    flushHeaders() {},
    write(chunk) {
      writes.push(chunk);
    },
  };
}

test('assina o canal do vídeo e envia headers SSE corretos', () => {
  const subscriber = createFakeSubscriber();
  const controller = createProgressController({ subscriber });
  const req = createFakeReq('v1');
  const res = createFakeRes();

  controller.handle(req, res);

  assert.deepEqual(subscriber.subscribeCalls, ['video:v1']);
  assert.equal(res.headers['Content-Type'], 'text/event-stream');
  assert.equal(res.headers['Cache-Control'], 'no-cache');

  req.emit('close');
});

test('repassa apenas mensagens do canal correspondente como evento SSE', () => {
  const subscriber = createFakeSubscriber();
  const controller = createProgressController({ subscriber });
  const req = createFakeReq('v1');
  const res = createFakeRes();

  controller.handle(req, res);
  subscriber.emit('message', 'video:v1', '{"percent":50}');
  subscriber.emit('message', 'video:outro', '{"percent":99}');

  assert.deepEqual(res.writes, ['data: {"percent":50}\n\n']);

  req.emit('close');
});

test('não desinscreve o canal enquanto outro cliente ainda o observa (bug de múltiplas abas)', () => {
  const subscriber = createFakeSubscriber();
  const controller = createProgressController({ subscriber });

  const reqA = createFakeReq('v1');
  const resA = createFakeRes();
  const reqB = createFakeReq('v1');
  const resB = createFakeRes();

  controller.handle(reqA, resA);
  controller.handle(reqB, resB);

  assert.deepEqual(subscriber.subscribeCalls, ['video:v1']);

  reqA.emit('close');
  assert.deepEqual(subscriber.unsubscribeCalls, [], 'não deve desinscrever enquanto B ainda está conectado');

  subscriber.emit('message', 'video:v1', '{"percent":80}');
  assert.deepEqual(resB.writes, ['data: {"percent":80}\n\n'], 'B ainda deve receber eventos após A fechar');

  reqB.emit('close');
  assert.deepEqual(subscriber.unsubscribeCalls, ['video:v1'], 'deve desinscrever quando o último cliente fecha');
});

test('desinscreve o canal quando o cliente fecha a conexão (caso de um único cliente)', () => {
  const subscriber = createFakeSubscriber();
  const controller = createProgressController({ subscriber });
  const req = createFakeReq('v1');
  const res = createFakeRes();

  controller.handle(req, res);
  req.emit('close');

  assert.deepEqual(subscriber.unsubscribeCalls, ['video:v1']);
  assert.equal(subscriber.listenerCount('message'), 0);
});
