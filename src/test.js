import timer from './timer'

const t = new timer()
t.start()

setTimeout(()=>{
  console.log(t.stop().ms)
}, 3000)