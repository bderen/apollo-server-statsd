class dummyClient {
  constructor(){}

  send(name, value, tags) {
    console.info('dummyCLient:send');
    console.log(name, value, tags);
  }
}

module.exports = dummyClient