const EventEmitter = require('events');

var startTime  = process.hrtime()
var startUsage = process.cpuUsage()

class appMonitor extends EventEmitter {
  constructor() {
    super()
    const _this = this
    setInterval(function(){
      _this.cpu()
      _this.gc()
    }, 5000)
  }
  cpu() {
    let newStartTime = process.hrtime();
    let newStartUsage = process.cpuUsage();
  
    var elapTime = process.hrtime(startTime)
    var elapUsage = process.cpuUsage(startUsage)
  
    startTime = newStartTime;
    startUsage = newStartUsage;
  
    var elapTimeMS = hrtimeToMS(elapTime)
  
    var elapUserMS = elapUsage.user / 1000; // microseconds to milliseconds
    var elapSystMS = elapUsage.system / 1000;
    var cpuPercent = (100 * (elapUserMS + elapSystMS) / elapTimeMS).toFixed(2)

    this.emit('cpu', {process: elapUserMS, system: elapSystMS, percent: cpuPercent})
  }
  gc() {
    const mem = process.memoryUsage()
    this.emit('gc', {size: mem.heapTotal, used: mem.heapUsed})
  }
}

function hrtimeToMS (hrtime) {
  return hrtime[0] * 1e3 + hrtime[1] / 1e6
}

module.exports = appMonitor