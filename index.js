const { Client, MessageAttachment, APIMessage, Intents } = require('discord.js')
const { inspect } = require('util')
const pool = require('workerpool').pool('./worker.js', {
  workerType: 'process',
})

const client = new Client({
  ws: {
    intents: Intents.NON_PRIVILEGED,
  },
  presence: {
    activity: {
      name: 'JavaScript',
      type: 'PLAYING',
    },
  },
})

const codeBlockRegex = /^`{3}(?<lang>[a-z]+)\n(?<code>[\s\S]+)\n`{3}$/mu
const languages = ['js', 'javascript']

const parseResult = content => {
  const text = inspect(content, { depth: null, maxArrayLength: null })
  if (text.length <= 2000)
    return APIMessage.transformOptions(text, { code: 'js' })
  else
    return APIMessage.transformOptions(
      '実行結果が長すぎるのでテキストファイルに出力しました。',
      new MessageAttachment(Buffer.from(text), 'result.txt')
    )
}

/**
 * リアクションで削除可能なメッセージを送信します。
 * @param {import('discord.js').Message} message
 * @param {import('discord.js').APIMessageContentResolvable | import('discord.js').MessageAdditions | import('discord.js').MessageOptions} content
 */
const sendDeleteableMessage = async (message, content) => {
  const replies = await message.reply(content)
  const wastebasket = '🗑️'
  const filter = (reaction, user) =>
    reaction.emoji.name === wastebasket && user.id === message.author.id

  if (Array.isArray(replies)) {
    const lastReply = replies[replies.length - 1]

    lastReply
      .react(wastebasket)
      .then(reaction =>
        reaction.message.awaitReactions(filter, {
          idle: 60000,
          max: 1,
          errors: ['idle'],
        })
      )
      .then(() =>
        Promise.all(replies.map(reply => reply.delete()).push(message.delete()))
      )
      .catch(() => lastReply.reactions.removeAll())
  } else {
    /** @type {import('discord.js').Message} */
    const reply = replies

    reply
      .react(wastebasket)
      .then(reaction =>
        reaction.message.awaitReactions(filter, {
          idle: 60000,
          max: 1,
          errors: ['idle'],
        })
      )
      .then(() => Promise.all([sender.delete(), reply.delete()]))
      .catch(() => reply.reactions.removeAll())
  }
}

client.once('ready', () => console.log('Ready'))

client.on('message', message => {
  if (message.author.bot || message.system) return
  if (!message.content.toLowerCase().startsWith('>runjs')) return
  if (!codeBlockRegex.test(message.content))
    return message.reply('コードを送信してください。').catch(console.error)

  const codeBlock = message.content.match(codeBlockRegex)?.groups ?? {}

  if (!languages.includes(codeBlock.lang))
    return message
      .reply(`言語識別子が**${languages.join(', ')}**である必要があります。`)
      .catch(console.error)

  pool
    .exec('run', [codeBlock.code])
    .timeout(5000)
    .then(result => sendDeleteableMessage(message, parseResult(result)))
    .catch(error =>
      sendDeleteableMessage(message, { content: error, code: 'js' })
    )
})

client.login().catch(console.error)
