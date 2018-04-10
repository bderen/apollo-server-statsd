const NATS = require('nats');
class natsClient {
  constructor(){
    this.client = NATS.connect({ maxReconnectAttempts: -1, reconnectTimeWait: 250, waitOnFirstConnect: true, reconnect: true })
    if (this.client) this.client.MAX_CONTROL_LINE_SIZE = 1024; //(or match server or any custom size you provide to the server.)
  }

  send(payload) {
    this.client.publish('metrics', payload);
  }
}

module.exports = natsClient