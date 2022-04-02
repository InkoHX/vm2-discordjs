'use strict'

const { worker } = require('workerpool')
const { VM } = require('vm2')
const { inspect } = require('util')
const { Console } = console
const { Writable } = require('stream')

const errorToString = err => {
  if (typeof err === 'object' && err instanceof Error) {
    return Error.prototype.toString.call(err)
  }
  return 'Thrown: ' + inspect(err, { depth: null, maxArrayLength: null })
}

function cloneDescriptors(descriptors, clonedCache) {
  Reflect.ownKeys(descriptors).forEach(key => {
    const descriptor = descriptors[key]
    if ('value' in descriptor)
      descriptor.value = clone(descriptor.value, clonedCache)
    if ('get' in descriptor) descriptor.get = clone(descriptor.get, clonedCache)
    if ('set' in descriptor) descriptor.set = clone(descriptor.set, clonedCache)
  })
}

function clone(value, clonedCache) {
  switch (typeof value) {
    case 'number':
    case 'boolean':
    case 'string':
    case 'symbol':
    case 'bigint':
    case 'undefined':
      return value
    case 'object':
      return value === null ? null : cloneObject(value, clonedCache)
    case 'function':
      return cloneFunction(value, clonedCache)
  }
  throw new TypeError('A value that is unknown type could not be cloned')
}

const objProtoIgnore = Set.prototype.has.bind(new Set([Object.prototype, null]))
function cloneObject(original, clonedCache) {
  if (clonedCache.has(original)) return clonedCache.get(original)
  const cloned = structuredClone(original)
  clonedCache.set(original, cloned)
  clonedCache.set(cloned, cloned)
  const proto = Object.getPrototypeOf(original)
  if (!objProtoIgnore(proto))
    Object.setPrototypeOf(cloned, clone(proto, clonedCache))
  const descriptors = Object.getOwnPropertyDescriptors(original)
  cloneDescriptors(descriptors, clonedCache)
  Object.defineProperties(cloned, descriptors)
  return cloned
}

const funcProtoIgnore = Set.prototype.has.bind(
  new Set([Function.prototype, Object.prototype, null])
)
function cloneFunction(original, clonedCache, bindThis) {
  if (clonedCache.has(original)) return clonedCache.get(original)
  const inner = (thisArg, args, newTarget) =>
    newTarget
      ? Reflect.construct(original, args, newTarget)
      : Reflect.apply(original, thisArg, args)
  const [cloned, unbound] = (unbound =>
    bindThis ? [unbound.bind(), unbound] : [unbound])(function () {
    return inner(this, arguments, new.target)
  })
  clonedCache.set(original, cloned)
  clonedCache.set(cloned, cloned)
  const proto = Object.getPrototypeOf(original)
  if (!funcProtoIgnore(proto)) {
    const clonedProto = clone(proto, clonedCache)
    Object.setPrototypeOf(cloned, clonedProto)
    if (bindThis) Object.setPrototypeOf(unbound, clonedProto)
  }
  const descriptors = Object.getOwnPropertyDescriptors(original)
  cloneDescriptors(descriptors, clonedCache)
  Object.defineProperties(cloned, descriptors)
  if (bindThis) Object.defineProperties(unbound, descriptors)
  return cloned
}

const run = async code => {
  const clonedCache = new WeakMap()
  const cloneClass = constructor =>
    cloneFunction(constructor, clonedCache, true)
  const consoleOutput = []
  const outStream = Object.defineProperty(new Writable(), 'write', {
    value: chunk => consoleOutput.push(chunk),
  })
  console.time()
  const clones = {
    Set: cloneClass(Set),
    Map: cloneClass(Map),
    Date: cloneClass(Date),
    WeakSet: cloneClass(WeakSet),
    WeakMap: cloneClass(WeakMap),
    ArrayBuffer: cloneClass(ArrayBuffer),
    SharedArrayBuffer: cloneClass(SharedArrayBuffer),
    Int8Array: cloneClass(Int8Array),
    Uint8Array: cloneClass(Uint8Array),
    Uint8ClampedArray: cloneClass(Uint8ClampedArray),
    Int16Array: cloneClass(Int16Array),
    Uint16Array: cloneClass(Uint16Array),
    Int32Array: cloneClass(Int32Array),
    Uint32Array: cloneClass(Uint32Array),
    Float32Array: cloneClass(Float32Array),
    Float64Array: cloneClass(Float64Array),
    BigInt64Array: cloneClass(BigInt64Array),
    BigUint64Array: cloneClass(BigUint64Array),
    Atomics: cloneObject(Atomics, clonedCache),
    DataView: cloneClass(DataView),
  }
  console.timeEnd()
  const vm = new VM({
    sandbox: {
      ...clones,
      Buffer,
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
