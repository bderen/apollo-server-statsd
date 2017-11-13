export default class {
  constructor() {
    this.hrtime = 0
    this.duration = 0
    this.ms = 0
  }
  start() {
    this.hrtime = process.hrtime()
    return this
  }
  stop() {
    const t = process.hrtime(this.hrtime)
    this.duration = t[0] * 1e9 + t[1]
    this.ms = this.duration / 1e6
    return this
  }
}