'use strict'

const { worker } = require('workerpool')
const { VM } = require('vm2')
const { inspect } = require('node:util')
const { isUint8Array } = require('node:util/types')
const { Writable } = require('node:stream')
const path = require('node:path')
const { readFileSync } = require('node:fs')
const { readonlyObjects, constructors } = require('./readonly')
const { Console } = console
const { isEncoding, from: makeBufferFrom } = Buffer
const { call } = Function.prototype
const { construct } = Reflect
const {
  getPrototypeOf,
  getOwnPropertyDescriptor,
  getOwnPropertyDescriptors,
  defineProperty,
} = Object

const primitives = ['Number', 'String', 'Boolean', 'Symbol', 'BigInt']
const vmSetupScript = readFileSync(path.join(__dirname, './setup.js'), 'utf8')
const typedArrayPrototype = getPrototypeOf(Uint8Array.prototype)
const typedArrayProtoDescriptors =
  getOwnPropertyDescriptors(typedArrayPrototype)
const arrayBuffer = call.bind(typedArrayProtoDescriptors.buffer.get)
const offset = call.bind(typedArrayProtoDescriptors.byteOffset.get)
const length = call.bind(typedArrayProtoDescriptors.byteLength.get)
const errorToString = err => {
  if (typeof err === 'object' && err instanceof Error)
    return Error.prototype.toString.call(err)
  return 'Thrown: ' + inspect(err, { depth: null, maxArrayLength: null })
}

const run = async code => {
  const consoleOutput = []
  const outStream = defineProperty(new Writable(), 'write', {
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
      if (typeof chunk === 'string') chunk = makeBufferFrom(chunk, encoding)
      else if (isUint8Array(chunk))
        chunk = makeBufferFrom(arrayBuffer(chunk), offset(chunk), length(chunk))
      else
        throw new TypeError(
          'Invalid chunk type. The chunk must be a string, a Buffer or a Uint8Array'
        )

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

  primitives.forEach(type => {
    const prototype = vm.run(type + '.prototype')
    const valueOf = call.bind(prototype.valueOf)
    defineProperty(prototype, inspect.custom, {
      value() {
        if (typeof this !== 'object') return this
        try {
          return `[${type}: ${inspect(valueOf(this))}]`
        } catch {
          return this
        }
      },
    })
  })

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
