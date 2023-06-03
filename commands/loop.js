'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType  } from 'discord.js'
import { CreateEmbed, WarningEmbed } from "../functions/interface.js"
import { checkUsability } from '../functions/misc.js'

const command = new Object()
command.name = 'loop'
command.description = `Choose the queue's loop mode`
command.options = [ { name: "mode", description: 'Choose which mode to enable.', choices: [  { name: 'Disable All Loops', value: 'disable' }, { name: 'Loop Current Song', value: 'current' }, { name: 'Loop All Songs', value: 'all' } ], type: ApplicationCommandOptionType.String, required: true }  ]
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 0

async function execute(interaction, resolvedUser, discordClient) { 

    let queue = process.meta.queues.get(interaction.guild.id)
    if (!queue) { return interaction.reply({ embeds: [WarningEmbed("Ducky is not playing anything in this server.", `To control playback, join a voice channel and play a song first.`)], components: [], ephemeral: true }).catch(() => {})  }
    if (!queue.songs.previous[0] && !queue.songs.current) { return interaction.reply({ embeds: [WarningEmbed("There is no song currently playing and no previous songs.", `To rewind, the queue must not be fully empty.`)], components: [], ephemeral: true }).catch(() => { }) }

    const mode = interaction.options.get('mode').value

    try { await checkUsability(interaction.member, interaction.guild) } catch (error) { 

        let joinableError = String(error.message)
        return interaction.reply({ embeds: [WarningEmbed("You can't use this command right now.", joinableError)], ephemeral: true })

    }

    let description = ''

    switch (mode) { 
        
        case 'disable': 
            queue.loops.currentSong = false
            queue.loops.entireQueue = false
            description = 'All loops have been disabled.'
        break
        
        case 'current': 
            queue.loops.currentSong = true
            queue.loops.entireQueue = false
            description = 'The current song has been looped.'
        break
        
        case 'all': 
            queue.loops.currentSong = false
            queue.loops.entireQueue = true
            description = 'All songs will loop when the queue ends.'
        break

    }
    
    return interaction.reply({ embeds: [CreateEmbed(`Changed the queue's loop mode.`, description, 'Playback Controls', interaction.member) ] })
    
}

async function execute_voice(args, queue, user) {

    if (queue.loops.currentSong) {

        queue.loops.currentSong = false
        queue.loops.entireQueue = true

        await queue.speak('All upcoming songs are now looped.')

    }

    else if (queue.loops.entireQueue) {

        queue.loops.currentSong = false
        queue.loops.entireQueue = false

        await queue.speak('All loops are now disabled.')

    }

    else {

        queue.loops.currentSong = true
        await queue.speak('The current song is now looped.')

    }

}

export { command, commandData, execute, execute_voice }