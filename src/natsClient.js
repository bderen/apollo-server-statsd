const NATS = require('nats');
export default class {
  constructor(){
    this.client = NATS.connect({ waitOnFirstConnect: true, reconnect: true })
  }

  send(payload) {
    this.client.publish('metrics', payload);
  }
}