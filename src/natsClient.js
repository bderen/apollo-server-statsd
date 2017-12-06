const NATS = require('nats');
class natsClient {
  constructor(){
    this.client = NATS.connect({ waitOnFirstConnect: true, reconnect: true })
  }

  send(payload) {
    this.client.publish('metrics', payload);
  }
}

module.exports = natsClient