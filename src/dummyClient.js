export default class {
  constructor(){}

  send(name, value, tags) {
    console.info('dummyCLient:send');
    console.log(name, value, tags);
  }
}