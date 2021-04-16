const { Structures } = require("discord.js");

module.exports = Structures.extend('Message', BaseClass => class extends BaseClass {
  /**
   * @param {import('discord.js').StringResolvable|import('discord.js').APIMessage} content 
   * @param {import('discord.js').MessageOptions|import('discord.js').MessageAdditions} options 
   */
  async sendDeleteable(content, options = {}) {
    const replies = await this.reply(content, options)
    const wastebasket = '🗑️'
    const filter = (reaction, user) =>
      reaction.emoji.name === wastebasket && user.id === this.author.id

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
          Promise.all(replies.map(reply => reply.delete()).push(this.delete()))
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
        .then(() => Promise.all([message.delete(), reply.delete()]))
        .catch(() => reply.reactions.removeAll())
    }
  }
})
