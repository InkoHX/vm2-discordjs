const workerpool = require('workerpool')
const { VM } = require('vm2')

const run = code => new VM().run(code)

workerpool.worker({ run })
