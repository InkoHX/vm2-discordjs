const worker = require('workerpool').worker
const { VM } = require('vm2')
const { inspect } = require('util')

const run = code => inspect(new VM().run(code), { depth: null, maxArrayLength: null })

worker({ run })
