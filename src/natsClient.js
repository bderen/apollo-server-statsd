const NATS = require('nats');

class natsClient {
  constructor(options){
    this.channel = (options && options.nats && options.nats.channel) ? options.nats.channel : 'metrics';
    this.client = NATS.connect({ maxReconnectAttempts: -1, reconnectTimeWait: 250, waitOnFirstConnect: true, reconnect: true })
  }

  send(payload) {
    this.client.publish(this.channel, payload);
  }
}

module.exports = natsClient