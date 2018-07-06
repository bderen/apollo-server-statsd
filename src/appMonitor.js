const EventEmitter = require('events');

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
    const cp = process.cpuUsage()
    this.emit('cpu', {process: cp.user, system: cp.system})
  }
  gc() {
    const mem = process.memoryUsage()
    this.emit('gc', {size: mem.heapTotal, used: mem.heapUsed})
  }
}

module.exports = appMonitor