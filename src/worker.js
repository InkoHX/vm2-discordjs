const { worker } = require('workerpool')
const { VM } = require('vm2')
const { inspect } = require('util')
const { Console } = console
const { Writable } = require('stream')

const run = async code => {
  const consoleOutput = []
  const outStream = Object.defineProperty(new Writable(), 'write', {
    value: chunk => consoleOutput.push(chunk),
  })
  const vm = new VM({
    sandbox: {
      Set,
      Map,
      Date,
      WeakSet,
      WeakMap,
      Buffer,
      ArrayBuffer,
      SharedArrayBuffer,
      Int8Array,
      Uint8Array,
      Uint8ClampedArray,
      Int16Array,
      Uint16Array,
      Int32Array,
      Uint32Array,
      Float32Array,
      Float64Array,
      BigInt64Array,
      BigUint64Array,
      Atomics,
      DataView,
      console: new Console({
        stdout: outStream,
        stderr: outStream,
        inspectOptions: { depth: null, maxArrayLength: null },
      }),
    },
  })

  const { call } = Function.prototype

  for (const type of ['Number', 'String', 'Boolean', 'Symbol', 'BigInt']) {
    const { prototype } = vm.run(type)
    const valueOf = call.bind(prototype.valueOf)
    const toString = call.bind(prototype.toString)
    Object.defineProperty(prototype, inspect.custom, {
      value() {
        try {
          return `[${type}: ${toString(valueOf(this))}]`
        } catch {}
        return this
      },
    })
  }

  const vmRegExpPrototype = vm.run('RegExp').prototype,
    vmRegExpProtoToString = call.bind(vmRegExpPrototype.toString)
  Object.defineProperty(vmRegExpPrototype, inspect.custom, {
    value() {
      try {
        return vmRegExpProtoToString(this)
      } catch {}
      return this
    },
  })

  let result
  try {
    result = await vm.run(code)
  } catch (ex) {
    return [consoleOutput.join(''), Error.prototype.toString.call(ex)]
  }

  return [
    consoleOutput.join(''),
    inspect(result, { depth: null, maxArrayLength: null }),
  ]
}

worker({ run })
