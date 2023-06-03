'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType  } from 'discord.js'
import { CreateEmbed, WarningEmbed } from "../functions/interface.js"
import { log, checkUsability } from '../functions/misc.js'

const command = new Object()
command.name = 'disconnect'
command.voiceName = 'leave'
command.description = `Disconnect Ducky from it's curren voice channel.`
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 0

async function execute(interaction, resolvedUser, discordClient) { 

    let queue = process.meta.queues.get(interaction.guild.id)
    if (!queue) { return interaction.reply({ embeds: [WarningEmbed("Ducky is not playing anything in this server.", `To control playback, join a voice channel and play a song first.`)], components: [], ephemeral: true }).catch(() => {})  }

    try { await checkUsability(interaction.member, interaction.guild) } catch (error) { 

        let joinableError = String(error.message)
        return interaction.reply({ embeds: [WarningEmbed("You can't use this command right now.", joinableError)], ephemeral: true })

    }

    try { queue.connection.destroy() } catch (err) {
        
        return interaction.reply({ embeds: [WarningEmbed("Ducky could not disconnect from your call.", `Please try again or manually disconnect Ducky.`)], components: [], ephemeral: true }).catch(() => {})

    }
    
    interaction.reply({ embeds: [CreateEmbed('Voice Session Ended', `Disconnected from ${queue.voiceChannel?.name || 'your call'}.\nAny settings changed have been saved.`, `${interaction.member.user.username} Disconnected Ducky`, interaction.member)] }).catch((err) => { log('Interaction Error', err) })

}

async function execute_voice(args, queue, user) {

    try { queue.disconnect() } catch (err) {
        log('Disconnect Error', err)
        await queue.speak(`Sorry, but Ducky couldn't leave your call. Try manually disconnecting the bot.`)
        return
    }
    queue.destroy().catch((err) => { log('Queue Recycling Error', err) })

}

export { command, commandData, execute, execute_voice }