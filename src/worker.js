'use strict'

const { worker } = require('workerpool')
const { VM } = require('vm2')
const { inspect } = require('util')
const { Console } = console
const { Writable } = require('stream')

function errorToString(err) {
  if (typeof err === 'object' && err instanceof Error) {
    return Error.prototype.toString.call(err)
  }
  return 'Thrown: ' + inspect(err, { depth: null, maxArrayLength: null })
}

function wrapClass(originalClass) {
  const wrappingClass = function (...args) {
    return new.target
      ? Reflect.construct(originalClass, args, new.target)
      : Reflect.apply(originalClass, this, args)
  }
  const bound = wrappingClass.bind()
  const descriptors = {
    ...Object.getOwnPropertyDescriptors(originalClass),
    prototype: {
      ...Object.getOwnPropertyDescriptor(originalClass, 'prototype'),
      value: Object.create(Object.getPrototypeOf(originalClass.prototype), {
        ...Object.getOwnPropertyDescriptors(originalClass.prototype),
        constructor: {
          ...Object.getOwnPropertyDescriptor(
            originalClass.prototype,
            'constructor'
          ),
          value: bound,
        },
      }),
    },
  }
  const baseClass = Object.getPrototypeOf(originalClass)
  Object.setPrototypeOf(wrappingClass, baseClass)
  Object.setPrototypeOf(bound, baseClass)
  Object.defineProperties(wrappingClass, descriptors)
  Object.defineProperties(bound, descriptors)
  return bound
}

const run = async code => {
  const consoleOutput = []
  const outStream = Object.defineProperty(new Writable(), 'write', {
    value: chunk => consoleOutput.push(chunk),
  })
  const vm = new VM({
    sandbox: {
      Set: wrapClass(Set),
      Map: wrapClass(Map),
      Date: wrapClass(Date),
      WeakSet: wrapClass(WeakSet),
      WeakMap: wrapClass(WeakMap),
      Buffer,
      ArrayBuffer: wrapClass(ArrayBuffer),
      SharedArrayBuffer: wrapClass(SharedArrayBuffer),
      Int8Array: wrapClass(Int8Array),
      Uint8Array: wrapClass(Uint8Array),
      Uint8ClampedArray: wrapClass(Uint8ClampedArray),
      Int16Array: wrapClass(Int16Array),
      Uint16Array: wrapClass(Uint16Array),
      Int32Array: wrapClass(Int32Array),
      Uint32Array: wrapClass(Uint32Array),
      Float32Array: wrapClass(Float32Array),
      Float64Array: wrapClass(Float64Array),
      BigInt64Array: wrapClass(BigInt64Array),
      BigUint64Array: wrapClass(BigUint64Array),
      Atomics: Object.create(
        Object.prototype,
        Object.getOwnPropertyDescriptors(Atomics)
      ),
      DataView: wrapClass(DataView),
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
    Object.defineProperty(prototype, inspect.custom, {
      value() {
        try {
          return `[${type}: ${inspect(valueOf(this))}]`
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
    return [consoleOutput.join('').trim(), errorToString(ex)]
  }

  return [
    consoleOutput.join('').trim(),
    inspect(result, { depth: null, maxArrayLength: null }),
  ]
}

worker({ run })
