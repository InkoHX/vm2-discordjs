const { worker } = require('workerpool')
const { VM } = require('vm2')
const {
  inspect,
  types: { isUint8Array },
} = require('node:util')
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

  for (const constructor of [
    Set,
    Map,
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
    DataView,
  ]) {
    // Mark the class constructor readonly
    vm.readonly(constructor)

    // Mark the prototype and its properties readonly
    for (let o = constructor.prototype; o; o = Object.getPrototypeOf(o)) {
      vm.readonly(o)
      Reflect.ownKeys(o).forEach(k => {
        try {
          vm.readonly(o[k])
        } catch {
          // Ignore errors
        }
      })
    }

    // Add prototype mapping
    vm._addProtoMapping(constructor.prototype, constructor.prototype)

    // Set class constructor to global
    vm.sandbox[constructor.name] = constructor.prototype.constructor = proxify(
      constructor,
      (_, args, newTarget) => Reflect.construct(constructor, args, newTarget),
      key => {
        for (let o = constructor; o; o = Reflect.getPrototypeOf(o)) {
          const getter = Reflect.getOwnPropertyDescriptor(o, key)?.get
          if (getter) return getter
        }
      }
    )
  }

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
