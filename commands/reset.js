'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js'
import { checkUsability, log } from '../functions/misc.js'
import { CreateEmbed } from "../functions/interface.js"

const command = new Object()
command.name = 'reset'
command.description = `Resets the entire queue, removing all songs, changed settings current connections.`
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

    let voiceChannel = queue.voiceChannel

    try { queue.disconnect() } catch (err) { log('Disconnect Error', err) }
    try { queue.destroy(true) } catch (err) { log('Queue Recycling Error', err) }
    
    return interaction.reply({ embeds: [CreateEmbed('Reset this server\'s queue.', `Disconnected from ${voiceChannel?.name || 'your call'}.\nAny upcoming songs queued or settings changed **have been deleted**.`, `Queue Actions`, interaction.member)] }).catch((err) => { log('Interaction Error', err) })

    
}

export { command, commandData, execute }