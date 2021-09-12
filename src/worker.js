const { worker } = require('workerpool')
const { VM } = require('vm2')
const { inspect } = require('util')

const run = async code => {
  const vm = new VM({
    sandbox: {
      Set, Map, Date, WeakSet, WeakMap,
      Buffer, ArrayBuffer, SharedArrayBuffer,
      Int8Array, Uint8Array, Uint8ClampedArray,
      Int16Array, Uint16Array,
      Int32Array, Uint32Array,
      Float32Array, Float64Array,
      BigInt64Array, BigUint64Array
    }
  })
  const result = await vm.run(code)
  const VMRegExp = vm.run("RegExp")
  VMRegExpProtoToString = VMRegExp.prototype.toString
  Object.defineProperty(VMRegExp.prototype, inspect.custom, { 
    value(_, options) {
      try {
        return VMRegExpProtoToString.call(this)
      } catch {
        return inspect(
          Object.defineProperty(
            this, inspect.custom,
            { value: void 0 }
          ), 
          options
        )
      }
    }
  })
  for (const type of ["Number", "String", "Boolean", "Symbol", "BigInt"]) {
    const ctor = vm.run(type), toPrimitive = ctor.prototype.valueOf
    Object.defineProperty(ctor.prototype, inspect.custom, {
      value(_, options) {
        try {
          return `[${type}: ${inspect(toPrimitive.call(this))}]`
        } catch {
          return inspect(
            Object.defineProperty(
              this, inspect.custom,
              { value: void 0 }
            ), 
            options
          )
        }
      }
    })
  }
  return inspect(result, { depth: null, maxArrayLength: null })
}

worker({ run })
