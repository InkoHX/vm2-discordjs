Object.defineProperty(
  RegExp.prototype,
  Symbol.for('nodejs.util.inspect.custom'),
  {
    value: RegExp.prototype.toString,
  }
)

{
  const { isNaN } = Number,
    { prototype } = Date,
    { call } = Function.prototype,
    getTime = call.bind(prototype.getTime),
    toString = call.bind(prototype.toString),
    toISOString = call.bind(prototype.toISOString)
  Object.defineProperty(prototype, Symbol.for('nodejs.util.inspect.custom'), {
    value() {
      return isNaN(getTime(this)) ? toString(this) : toISOString(this)
    },
  })
}

{
  const call = Function.prototype.call.bind(Function.prototype.call),
    proxify = (value, construct, getters) =>
      new Proxy(value, {
        __proto__: null,
        get(_, key, receiver) {
          const getter = getters(key)
          return getter ? call(getter, receiver) : value[key]
        },
        construct,
      })
  proxify
}
