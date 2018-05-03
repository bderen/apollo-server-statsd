const NATS = require('nats');

class natsClient {
  constructor(){
    this.client = NATS.connect({ maxReconnectAttempts: -1, reconnectTimeWait: 250, waitOnFirstConnect: true, reconnect: true })
  }

  send(payload) {
    this.client.publish('metrics', payload);
  }
}

module.exports = natsClient