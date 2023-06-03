'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType  } from 'discord.js'
import { CreateEmbed, WarningEmbed } from "../functions/interface.js"
import { checkUsability, log } from '../functions/misc.js'

const command = new Object()
command.name = 'pause'
command.description = `Pause the current song playing.`
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 0

async function execute(interaction, resolvedUser, discordClient) { 

    let queue = process.meta.queues.get(interaction.guild.id)
    if (!queue) { return interaction.reply({ embeds: [WarningEmbed("Ducky is not playing anything in this server.", `To control playback, join a voice channel and play a song first.`)], components: [], ephemeral: true }).catch(() => {})  }
    if (!queue.songs.current) { return interaction.reply({ embeds: [WarningEmbed("There is no song currently playing.", `To control playback, a song must be playing first.`)], components: [], ephemeral: true }).catch(() => { }) }
    if (queue.activePlayer.current === 'radio') { return interaction.reply({ embeds: [WarningEmbed("You cannot pause the audio right now.", `Radio stations cannot be paused.`)], components: [], ephemeral: true }).catch(() => { })  }

    
    try { await checkUsability(interaction.member, interaction.guild) } catch (error) { 

        let joinableError = String(error.message)
        return interaction.reply({ embeds: [WarningEmbed("You can't use this command right now.", joinableError)], ephemeral: true })

    }

    try { queue.pause() } catch (err) { log('Play/Pause Error', err)}
    
    return interaction.reply({ embeds: [CreateEmbed('Paused the current audio playing.', `You can also pause and resume the audio with Ducky's play buttons.`, 'Playback Controls', interaction.member) ] }).catch((err) => { })
    
}

async function execute_voice(args, queue, user) { 

    if (!queue.songs.current) { return await queue.speak('There is nothing currently playing.') }
    if (queue.activePlayer.current === 'radio') { return await queue.speak('Radio stations cannot be paused.') }

    queue.pause(true)
    await queue.speak('The queue is now paused.')

} 

export { command, commandData, execute, execute_voice }
