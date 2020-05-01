const { parentPort } = require('worker_threads')
const { VM } = require('vm2')

parentPort.on('message', value => {
  try {
    const vm = new VM({ timeout: 5000 })

    parentPort.postMessage(vm.run(value))
  } catch (error) {
    parentPort.postMessage(error)
  }
})
