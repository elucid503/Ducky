'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType  } from 'discord.js'
import { CreateEmbed, WarningEmbed } from "../functions/interface.js"
import { checkUsability, log } from '../functions/misc.js'

const command = new Object()
command.name = 'next'
command.description = `Skip to the next song in the queue.`
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 0

async function execute(interaction, resolvedUser, discordClient) { 

    let queue = process.meta.queues.get(interaction.guild.id)
    if (!queue) { return interaction.reply({ embeds: [WarningEmbed("Ducky is not playing anything in this server.", `To control playback, join a voice channel and play a song first.`)], components: [], ephemeral: true }).catch(() => {})  }
    if (!queue.songs.current) { return interaction.reply({ embeds: [WarningEmbed("There is no song currently playing.", `To control playback, a song must be playing first.`)], components: [], ephemeral: true }).catch(() => { }) }

    let willBeSkipped = queue.songs.upcoming[0]

    try { await checkUsability(interaction.member, interaction.guild) } catch (error) { 

        let joinableError = String(error.message)
        return interaction.reply({ embeds: [WarningEmbed("You can't use this command right now.", joinableError)], ephemeral: true })

    }

    try { queue.skip(null) } catch (err) { log('Skip Error', err)}
    
    return interaction.reply({ embeds: [CreateEmbed('Skipped to the next song playing.', `${willBeSkipped?.titles?.display?.normal ? `Now playing **${willBeSkipped?.titles?.display?.normal || 'unknown.'}**` : 'There are no more upcoming songs.\nThe queue is now ending.' }`, 'Playback Controls', interaction.member) ] })
    
}

async function execute_voice(args, queue, user) { 

    if (!queue.songs.current) { return queue.speak('There is nothing currently playing.') }

    if (queue.songs.upcoming[0]) queue.skip(true) // skips transitions due to loading times
    else queue.skip()
} 

export { command, commandData, execute, execute_voice }