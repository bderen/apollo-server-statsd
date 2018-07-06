const needle = require('needle')
const os = require('os');

const formatTags = function (tags) {
  const _tags = tags.split(',')
  const formatedTags = _tags.map(function(t){
    const _t = t.split(':')
    const key = _t[0].trim().replace('"','').replace('"','');
    const val = _t[1].trim();
    return `${key}=${val}`;
  });
  return formatedTags.join(',')
}

let sendIntervalPromClient = null;
process.on('exit', function() {
  clearInterval(sendIntervalPromClient)
})

class prometheusClient {
  constructor(options){
    this.options = options;
    this.data = {};
    this.sendAgregatedData();
  }

  agregateData(name, data) {
    if (data.name === 'pageview') {
      const prev_val = this.data[name] ? this.data[name].value : 0
      const prev_name =  this.data[name] ? this.data[name].name : data.name
      this.data[name] = {name: prev_name, value: (prev_val + data.value)}
    } else {
      this.data[name] = data;
    }
  }

  sendAgregatedData() {
    const me = this
    sendIntervalPromClient = setInterval(function(){
      Object.keys(me.data).map(key => {
        me.sendToPrometheusPushGetaway(key, me.data[key])
      })
    }, this.options.sendAgregatedDataInterval || 5000)
  }

  send(msg) {
    return null
  }

  sendRaw(name, value, tags) {
    const _tags = formatTags(tags)
    const _name = name.replace('.','_')
    this.agregateData(`${_name}{${_tags}}`, {name: _name, value})
  }

  sendToPrometheusPushGetaway(key, data) {
    const options = {
      method: 'POST',
      hostname: this.options.prometheusHost || 'localhost',
      port: this.options.prometheusPort || 9091,
      path: `/metrics/job/apollo-server-stats/instance/${this.options.instance}`
    }

    // console.log(`# TYPE ${data.name} gauge\n${key} ${data.value}\n`)
    
    let dataCopy = this.data[key]
    this.data[key] = {name: this.data[key].name, value: 0}

    needle('post', options.hostname + ':' + options.port + options.path, 
           `# TYPE ${dataCopy.name} gauge\n${key} ${dataCopy.value}\n`)
    .then(function(response) {
      console.log('Sent stats!')
      dataCopy = null
      return null
    })
    .catch(function(err) {
      console.log('Err: ', err)
    })
  }
}

module.exports = prometheusClient