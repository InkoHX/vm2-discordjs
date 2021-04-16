const worker = require('workerpool').worker
const { VM } = require('vm2')

const run = code => new VM().run(code)

worker({ run })
