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

const Blockcontent = /^`{3}(?<lang>[a-z]+)\n(?<code>[\s\S]+)\n`{3}$/mu
const languages = ['js', 'javascript']
const toMessageOptions = content => {
  if (content.length <= 2000) return codeBlock('js', content)
  else
    return MessagePayload.create(message.channel, {
      content: '実行結果が長すぎるのでテキストファイルに出力しました。',
      attachment: [
        new MessageAttachment(
          codeBlock('js', Buffer.from(content)),
          'result.js'
        ),
      ],
    })
}

client.once('ready', () => console.log('Ready'))

client.on('message', message => {
  if (message.author.bot || message.system) return
  if (!message.content.toLowerCase().startsWith('>runjs')) return
  if (!BlockRegex.test(message.content))
    return message.reply('コードを送信してください。').catch(console.error)

  const Blockcontent = message.content.match(BlockRegex)?.groups ?? {}
  if (!languages.includes(Blockcontent.lang))
    return message
      .reply(`言語識別子が**${languages.join(', ')}**である必要があります。`)
      .catch(console.error)

  pool
    .exec('run', [Blockcontent.code])
    .timeout(5000)
    .then(result => message.sendDeletable(toMessageOptions(result)))
    .catch(error => message.sendDeletable(codeBlock('js', error)))
})

client.login().catch(console.error)
