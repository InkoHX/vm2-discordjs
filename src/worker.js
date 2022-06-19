const { worker } = require('workerpool')
const { VM } = require('vm2')
const {
  inspect,
  types: { isUint8Array },
} = require('node:util')
const { readonlyObjects, constructors } = require('./readonly')
const { Console } = console
const { Writable } = require('node:stream')
const { isEncoding, isBuffer } = Buffer
const bufferToString = Function.prototype.call.bind(Buffer.prototype.toString)
const vmSetupScript = require('node:fs').readFileSync(
  require('node:path').join(__dirname, './setup.js'),
  'utf8'
)

const errorToString = err => {
  if (typeof err === 'object' && err instanceof Error)
    return Error.prototype.toString.call(err)
  return 'Thrown: ' + inspect(err, { depth: null, maxArrayLength: null })
}

const run = async code => {
  const consoleOutput = []
  const outStream = Object.defineProperty(new Writable(), 'write', {
    value(chunk, encoding, callback) {
      switch (typeof encoding) {
        case 'function':
          callback = encoding
        case 'undefined':
          encoding = 'utf8'
          break
        default:
          if (!isEncoding(encoding))
            throw new TypeError(`Unknown encoding '${encoding}'`)
      }
      switch (true) {
        case isUint8Array(chunk):
          chunk = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)
        case isBuffer(chunk):
          chunk = bufferToString(chunk, encoding)
        case typeof chunk === 'string':
          break
        default:
          throw new TypeError(
            'Invalid chunk type. The chunk must be a string, a Buffer or a Uint8Array'
          )
      }

      consoleOutput.push(chunk)

      if (typeof callback === 'function') callback()
    },
  })
  const vm = new VM()

  vm.freeze(Atomics, 'Atomics')
  vm.freeze(
    new Console({
      stdout: outStream,
      stderr: outStream,
      inspectOptions: { depth: null, maxArrayLength: null },
    }),
    'console'
  )

  for (const type of ['Number', 'String', 'Boolean', 'Symbol', 'BigInt']) {
    const prototype = vm.run(type + '.prototype')
    const valueOf = Function.prototype.call.bind(prototype.valueOf)
    Object.defineProperty(prototype, inspect.custom, {
      value() {
        try {
          return `[${type}: ${inspect(valueOf(this))}]`
        } catch {}
        return this
      },
    })
  }

  const proxify = vm.run(vmSetupScript)

  readonlyObjects.forEach(obj => vm.readonly(obj))
  constructors.forEach(ctor => {
    const { prototype, name } = ctor

    // Add prototype mapping
    vm._addProtoMapping(prototype, prototype)

    // Set class constructor to global
    ctor = prototype.constructor = proxify(
      ctor,
      (_, args, newTarget) => construct(ctor, args, newTarget),
      key => {
        for (let o = ctor; o; o = getPrototypeOf(o)) {
          const getter = getOwnPropertyDescriptor(o, key)?.get
          if (getter) return getter
        }
      }
    )
    defineProperty(vm.sandbox, name, {
      writeble: true,
      configurable: true,
      value: ctor,
    })
  })

  try {
    const result = await vm.run(code)
    return [
      consoleOutput.join('').trim(),
      inspect(result, { depth: null, maxArrayLength: null }),
    ]
  } catch (ex) {
    return [consoleOutput.join('').trim(), errorToString(ex)]
  }
}

worker({ run })
