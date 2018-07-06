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

    var elapTimeMS = hrtimeToMS(process.hrtime(startTime));
    var elapUsageMS = usageToTotalUsageMS(process.cpuUsage(startUsage));
    var cpuPercent = (100.0 * elapUsageMS.total / elapTimeMS).toFixed(2)

    this.emit('cpu', {process: elapUsageMS.user, system: elapUsageMS.system, percent: cpuPercent})
  }
  gc() {
    const mem = process.memoryUsage()
    this.emit('gc', {size: mem.heapTotal, used: mem.heapUsed})
  }
}

function usageToTotalUsageMS(elapUsage) {
  var elapUserMS = elapUsage.user / 1000.0; // microseconds to milliseconds
  var elapSystMS = elapUsage.system / 1000.0;
  return {user: elapUserMS, system: elapSystMS, total: elapUserMS + elapSystMS};
}

function hrtimeToMS (hrtime) {
  return hrtime[0] * 1000.0 + hrtime[1] / 1000000.0;
}

module.exports = appMonitor