const { VM } = require('vm2')
const { Client, MessageAttachment, APIMessage } = require('discord.js')
const { inspect } = require('util')

const client = new Client()

const codeBlockRegex = /^`{3}(?<lang>[a-z]+)\n(?<code>[\s\S]+)\n`{3}$/um
const languages = ['js', 'javascript']
const toContent = content => {
  const text = inspect(content, { depth: null, breakLength: null })
  if (text.length <= 2000) return APIMessage.transformOptions(text, { code: true, split: true })
  else return APIMessage.transformOptions('実行結果が長すぎるのでテキストファイルに出力しました。', new MessageAttachment(text, 'result.txt'))
}

client.once('ready', () => console.log('Ready'))

client.on('message', message => {
  if (message.author.bot || message.system) return
  if (!message.content.toLowerCase().startsWith('>runjs')) return
  if (!codeBlockRegex.test(message.content)) return

  const codeBlock = codeBlockRegex.exec(message.content)?.groups

  if (codeBlock && !languages.includes(codeBlock.lang)) return

  try {
    const vm = new VM({ timeout: 5000 })
    const result = vm.run(codeBlock.code)

    return message.reply(toContent(result)).catch(console.error)
  } catch (error) {
    return message.reply(toContent(error)).catch(console.error)
  }
})

client.login().catch(console.error)
