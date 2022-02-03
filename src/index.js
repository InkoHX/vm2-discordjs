require('./structures/message')

const {
  Client,
  MessageAttachment,
  MessagePayload,
  Intents,
} = require('discord.js')
const path = require('path')
const pool = require('workerpool').pool(path.join(__dirname, './worker.js'), {
  workerType: 'process',
})
const { codeBlock } = require('@discordjs/builders')
const intents =
  Intents.FLAGS.GUILDS |
  Intents.FLAGS.GUILD_MESSAGES |
  Intents.FLAGS.GUILD_MESSAGE_REACTIONS

const client = new Client({
  intents,
  ws: {
    intents: intents,
  },
  presence: {
    activity: {
      name: 'JavaScript',
      type: 'PLAYING',
    },
  },
})

const BlockRegex = /^`{3}(?<lang>[a-z]+)\n(?<code>[\s\S]+)\n`{3}$/mu
const languages = ['js', 'javascript']
const toMessageOptions = content => {
  if (content.length <= 2000) return codeBlock('js', content)
  else {
    const File = new MessageAttachment(Buffer.from(content), 'result.txt')
    return MessagePayload.create(message.channel, {
      content: '実行結果が長すぎるのでテキストファイルに出力しました。',
      files: [File],
    })
  }
}

client.once('ready', () => console.log('Ready'))

client.on('messageCreate', message => {
  if (message.author.bot || message.system) return
  if (!message.content.toLowerCase().startsWith('>runjs')) return
  if (!BlockRegex.test(message.content))
    return message.reply('コードを送信してください。').catch(console.error)

  const BlockContent = message.content.match(BlockRegex)?.groups ?? {}
  if (!languages.includes(BlockContent.lang))
    return message
      .reply(`言語識別子が**${languages.join(', ')}**である必要があります。`)
      .catch(console.error)

  pool
    .exec('run', [BlockContent.code])
    .timeout(5000)
    .then(result => message.sendDeletable(toMessageOptions(result)))
    .catch(error => message.sendDeletable(codeBlock('js', error)))
})

client.login().catch(console.error)
