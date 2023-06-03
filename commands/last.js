'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType  } from 'discord.js'
import { CreateEmbed, WarningEmbed } from "../functions/interface.js"
import { log, checkUsability } from '../functions/misc.js'

const command = new Object()
command.name = 'last'
command.description = `Skip back to the last song playing.`
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 0

async function execute(interaction, resolvedUser, discordClient) { 

    let queue = process.meta.queues.get(interaction.guild.id)
    if (!queue) { return interaction.reply({ embeds: [WarningEmbed("Ducky is not playing anything in this server.", `To control playback, join a voice channel and play a song first.`)], components: [], ephemeral: true }).catch(() => {})  }
    if (!queue.songs.previous[0] && !queue.songs.current) { return interaction.reply({ embeds: [WarningEmbed("There is no song currently playing and no previous songs.", `To rewind, the queue must not be fully empty.`)], components: [], ephemeral: true }).catch(() => { }) }

    let willBeSkipped = queue.songs.previous[queue.songs.previous.length - 1]

    try { await checkUsability(interaction.member, interaction.guild) } catch (error) { 

        let joinableError = String(error.message)
        return interaction.reply({ embeds: [WarningEmbed("You can't use this command right now.", joinableError)], ephemeral: true })

    }

    try { queue.skip(null, true) } catch (err) { log('Skip Error', err)}
    
    return interaction.reply({ embeds: [CreateEmbed('Skipped to the last song playing.', `Now playing **${willBeSkipped?.titles?.display?.normal || 'unknown.'}**`, 'Playback Controls', interaction.member) ] })
    
}

async function execute_voice(args, queue, user) {

    if (!queue.songs.previous[0]) { return queue.speak('There was nothing previously playing.') }

    queue.songs.upcoming.insert(0, queue.songs.previous.pop() || queue.songs.current)
    queue.update()

    if (queue.state === 'playing') queue.skip(true) // skips transitions due to loading times
    else queue.skip()

}

export { command, commandData, execute, execute_voice }