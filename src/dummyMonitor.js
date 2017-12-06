class dummyMonitor {
  constructor(){}

  on(type) {
    switch (type) {
      case 'cpu':
        return this.cpu()
      case 'memory':
        return this.memory()
      case 'gc':
        return this.gc()
      case 'eventloop':
        return this.eventloop()
      case 'httpMetrics':
        return this.httpMetrics()
      default:
        return undefined
    }
  }

  cpu() {
    //process.cpuUsage()
    return {
      process: 0,
      system: 0
    }
  }

  memory() {
    //process.memoryUsage()
    return {
      private: 0,
      physical: 0,
      virtual: 0,
      physical_used: 0,
      physical_total: 0
    }
  }

  gc() {
    return {
      size: 0,
      used: 0,
      duration: 0
    }
  }

  eventloop() {
    return {
      latency: {
        min: 0,
        max: 0,
        avg: 0
      }
    }
  }
}

module.exports = dummyMonitor