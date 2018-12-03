class dummyClient {
  constructor(options){
    this.options = options;
  }

  send(name, value, tags) {
    console.info('dummyCLient:send');
    console.log(name, value, tags);
  }
}

module.exports = dummyClient