'use strict'

const { getPrototypeOf, ownKeys } = Reflect
const readonlySet = new Set()
const constructors = [
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
]
const iterableObjects = [new Set(), new Map(), []]

constructors.forEach(constructor => {
  readonlySet.add(constructor)

  // Mark the class's prototype and its properties as readonly
  for (let o = constructor.prototype; o; o = getPrototypeOf(o)) {
    readonlySet.add(o)
    ownKeys(o).forEach(k => {
      try {
        readonlySet.add(o[k])
      } catch {
        // Ignore errors
      }
    })
  }
})

iterableObjects.forEach(obj => {
  // Mark the iterator's prototype and its properties as readonly
  for (let o = getPrototypeOf(obj.keys()); o; o = getPrototypeOf(o)) {
    readonlySet.add(o)
    ownKeys(o).forEach(k => {
      try {
        readonlySet.add(o[k])
      } catch {
        // Ignore errors
      }
    })
  }
})

module.exports = {
  constructors,
  readonlyObjects: [...readonlySet],
}
