'use strict'

{
  const { call } = Function.prototype
  const { defineProperty, getOwnPropertyDescriptors } = Object
  const inspectCustom = Symbol.for('nodejs.util.inspect.custom')

  defineProperty(this, 'Function', {
    value: Function,
    writable: true,
    enumerable: false,
    configurable: true,
  })

  defineProperty(this, 'eval', {
    value: eval,
    writable: true,
    enumerable: false,
    configurable: true,
  })

  {
    const { prototype } = RegExp
    const descriptors = getOwnPropertyDescriptors(prototype)
    const source = call.bind(descriptors.source.get)
    const hasIndices = call.bind(descriptors.hasIndices.get)
    const global = call.bind(descriptors.global.get)
    const ignoreCase = call.bind(descriptors.ignoreCase.get)
    const multiline = call.bind(descriptors.multiline.get)
    const dotAll = call.bind(descriptors.dotAll.get)
    const unicode = call.bind(descriptors.unicode.get)
    const sticky = call.bind(descriptors.sticky.get)
    // RegExp#toString や RegExp#flags だと プロパティーアクセスが行われるため、副作用が発生する可能性がある。
    // それを避けるため、ひとつずつフラグを確認する。
    defineProperty(prototype, inspectCustom, {
      value() {
        try {
          let str = `/${source(this)}/`
          if (hasIndices(this)) str += 'd'
          if (global(this)) str += 'g'
          if (ignoreCase(this)) str += 'i'
          if (multiline(this)) str += 'm'
          if (dotAll(this)) str += 's'
          if (unicode(this)) str += 'u'
          if (sticky(this)) str += 'y'
          return str
        } catch {
          return this
        }
      },
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
