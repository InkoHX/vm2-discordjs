const { worker } = require('workerpool')
const { VM } = require('vm2')
const { inspect } = require('util')

const run = async code => {
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
    },
  })
  const vmRegExpPrototype = vm.run('RegExp').prototype,
    vmRegExpProtoToString = vmRegExpPrototype.toString
  const primitiveTypes = [
    'Number',
    'String',
    'Boolean',
    'Symbol',
    'BigInt',
  ].map(type => {
    const { prototype } = vm.run(type)
    return [type, prototype, prototype.valueOf]
  })

  let result
  try {
    result = await vm.run(code)
  } catch (ex) {
    return Error.prototype.toString.call(ex)
  }

  Object.defineProperty(vmRegExpPrototype, inspect.custom, {
    value(_, options) {
      try {
        return vmRegExpProtoToString.call(this)
      } catch {
        return inspect(
          Object.defineProperty(this, inspect.custom, { value: void 0 }),
          options
        )
      }
    },
  })
  for (const [type, prototype, toPrimitive] of primitiveTypes) {
    Object.defineProperty(prototype, inspect.custom, {
      value(_, options) {
        try {
          return `[${type}: ${inspect(toPrimitive.call(this))}]`
        } catch {
          return inspect(
            Object.defineProperty(this, inspect.custom, { value: void 0 }),
            options
          )
        }
      },
    })
  }

  return inspect(result, { depth: null, maxArrayLength: null })
}

worker({ run })
