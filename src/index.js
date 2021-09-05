require('./structures/message')

const { Client, MessageAttachment, APIMessage, Intents } = require('discord.js')
const path = require('path')
const pool = require('workerpool').pool(path.join(__dirname, './worker.js'), {
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

const toMessageOptions = content => {
  if (content.length <= 2000)
    return APIMessage.transformOptions(content, { code: 'js' })
  else
    return APIMessage.transformOptions(
      '実行結果が長すぎるのでテキストファイルに出力しました。',
      new MessageAttachment(Buffer.from(content), 'result.txt')
    )
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
    .then(result => message.sendDeleteable(toMessageOptions(result)))
    .catch(error => message.sendDeleteable(error, { code: 'js' }))
})

client.login().catch(console.error)
