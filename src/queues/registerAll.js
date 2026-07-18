/**
 * Processor registration helper — called once at API/worker/scheduler boot to
 * wire up all the BullMQ processors (or their inline fallbacks in test env).
 *
 * Centralizing this here means the API process can use the inline fallback
 * for tests without needing to import each processor individually.
 */
const queues = require('./index');
const { QUEUE_NAMES } = queues;
const { confirmPayment } = require('./processors/paymentWebhook');
const { fanOutBroadcast } = require('./processors/broadcast');
const { runDigest } = require('./processors/digest');

let _registered = false;

function registerAll() {
  if (_registered) return;
  queues.registerProcessor(QUEUE_NAMES.PAYMENT_WEBHOOK, 'confirm', confirmPayment);
  queues.registerProcessor(QUEUE_NAMES.BROADCAST, 'fanOut', fanOutBroadcast);
  queues.registerProcessor(QUEUE_NAMES.DIGEST, 'run', runDigest);
  _registered = true;
}

module.exports = { registerAll };
