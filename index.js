const { Client, MessageAttachment, APIMessage } = require('discord.js')
const { inspect } = require('util')
const pool = require('workerpool').pool('./worker.js')

const client = new Client()

const codeBlockRegex = /^`{3}(?<lang>[a-z]+)\n(?<code>[\s\S]+)\n`{3}$/um
const languages = ['js', 'javascript']
const toContent = content => {
  const text = inspect(content, { depth: null, maxArrayLength: null })
  if (text.length <= 2000) return APIMessage.transformOptions(text, { code: 'js', split: true })
  else return APIMessage.transformOptions('実行結果が長すぎるのでテキストファイルに出力しました。', new MessageAttachment(Buffer.from(text), 'result.txt'))
}

client.once('ready', () => console.log('Ready'))

client.on('message', message => {
  if (message.author.bot || message.system) return
  if (!message.content.toLowerCase().startsWith('>runjs')) return
  if (!codeBlockRegex.test(message.content)) return message.reply('コードを送信してください。')
    .catch(console.error)

  const codeBlock = codeBlockRegex.exec(message.content).groups

  if (!languages.includes(codeBlock.lang)) return message.reply(`言語識別子が**${languages.join(', ')}**である必要があります。`)
    .catch(console.error)

  pool.exec('run', [codeBlock.code])
    .timeout(5000)
    .then(value => message.reply(toContent(value)))
    .catch(error => message.reply(error, { code: 'js' }))
})

client.login()
  .catch(console.error)
