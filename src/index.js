require('./structures/message')

const {
  Client,
  AttachmentBuilder,
  GatewayIntentBits: {
    Guilds,
    GuildMessages,
    GuildMessageReactions,
    MessageContent,
  },
  bold,
  codeBlock,
} = require('discord.js')
const path = require('path')
const pool = require('workerpool').pool(path.join(__dirname, './worker.js'), {
  workerType: 'process',
})

const client = new Client({
  intents: [Guilds, GuildMessages, GuildMessageReactions, MessageContent],
  presence: {
    activities: [
      {
        name: 'JavaScript',
        type: 'PLAYING',
      },
    ],
  },
})

const codeBlockRegex = /^`{3}(?<language>[a-z]+)\n(?<code>[\s\S]+)\n`{3}$/mu
const languages = ['js', 'javascript']
const toMessageOptions = (consoleOutput, result) => {
  if (consoleOutput.split('\n').length <= 100) {
    let wrapped = codeBlock('js', result.replaceAll('`', '`\u200b'))
    if (consoleOutput) {
      wrapped =
        bold('コンソール') +
        codeBlock('js', consoleOutput.replaceAll('`', '`\u200b')) +
        '\n' +
        bold('結果') +
        wrapped
    }
    if (wrapped.length <= 2000)
      return { content: wrapped, allowedMentions: { repliedUser: true } }
  }
  const files = [
    new AttachmentBuilder(Buffer.from(result), { name: 'result.txt' }),
  ]
  if (consoleOutput)
    files.unshift(
      new AttachmentBuilder(Buffer.from(consoleOutput), { name: 'console.txt' })
    )
  return {
    content: '実行結果が長すぎるのでテキストファイルに出力しました。',
    files,
  }
}

client.once('ready', () => console.log('Ready'))

client.on('messageCreate', message => {
  if (message.author.bot || message.system) return
  if (!message.content.toLowerCase().startsWith('>runjs')) return
  if (!codeBlockRegex.test(message.content))
    return message.reply('コードを送信してください。').catch(console.error)

  const { language, code } = message.content.match(codeBlockRegex)?.groups ?? {}
  if (!languages.includes(language))
    return message
      .reply(`言語識別子が**${languages.join(', ')}**である必要があります。`)
      .catch(console.error)

  pool
    .exec('run', [code])
    .timeout(5000)
    .then(([consoleOutput, result]) =>
      message.sendDeletable(toMessageOptions(consoleOutput, result))
    )
    .catch(error => message.sendDeletable(codeBlock('js', error)))
})

client.login().catch(console.error)
