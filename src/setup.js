'use strict'

{
  const { call } = Function.prototype
  const { defineProperty } = Object
  const inspectCustom = Symbol.for('nodejs.util.inspect.custom')

  {
    const { prototype } = RegExp
    defineProperty(prototype, inspectCustom, {
      value: prototype.toString,
    })
  }

  {
    const { isNaN } = Number
    const { prototype } = Date
    const getTime = call.bind(prototype.getTime)
    const toString = call.bind(prototype.toString)
    const toISOString = call.bind(prototype.toISOString)
    defineProperty(prototype, inspectCustom, {
      value() {
        try {
          return isNaN(getTime(this)) ? toString(this) : toISOString(this)
        } catch {
          return this
        }
      },
    })
  }

  {
    const funcCall = call.bind(call)
    const proxify = (value, construct, getters) =>
      new Proxy(value, {
        __proto__: null,
        construct,
        get(_, key, receiver) {
          const getter = getters(key)
          return getter ? funcCall(getter, receiver) : value[key]
        },
      })
    proxify
  }
}
