const { VM } = require('vm2')
const { Client, Util, MessageAttachment } = require('discord.js')

const client = new Client()
const vm = new VM({ timeout: 5000 })

const codeBlockRegex = /^`{3}(?<lang>[a-z]+)\n(?<code>[\s\S]+)\n`{3}$/um
const languages = ['js', 'javascript']
const toContent = content => {
  const text = Util.resolveString(content)
  if (text.length <= 2000) return text
  else new MessageAttachment(text, 'result.txt')
}

client.once('ready', () => console.log('Ready'))

client.on('message', message => {
  if (message.author.bot || message.system) return
  if (!message.content.toLowerCase().startsWith('>runjs')) return
  if (!codeBlockRegex.test(message.content)) return

  const codeBlock = codeBlockRegex.exec(message.content)?.groups

  if (codeBlock && !languages.includes(codeBlock.lang)) return

  try {
    const result = vm.run(codeBlock.code)

    return message.reply(toContent(result), { code: 'js' }).catch(console.error)
  } catch (error) {
    return message.reply(toContent(error), { code: 'js' }).catch(console.error)
  }
})

client.login().catch(console.error)
