'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js'
import { CreateEmbed, WarningEmbed } from "../functions/interface.js"
import { log } from '../functions/misc.js'

const command = new Object()
command.name = 'autoplay'
command.description = `Enable or disable autoplay for the queue.`
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 0

async function execute(interaction, resolvedUser, discordClient) { 

    let queue = process.meta.queues.get(interaction.guild.id)
    if (!queue) { return interaction.reply({ embeds: [WarningEmbed("Ducky is not playing anything in this server.", `To change settings, join a voice channel and play a song first.`)], components: [], ephemeral: true }).catch(() => {})  }
    if (!queue.songs.previous[0] && !queue.songs.current) { return interaction.reply({ embeds: [WarningEmbed("The queue includes no songs.", `To enable autoplay, at least one song must have been played.`)], components: [], ephemeral: true }).catch(() => {})  }

    const { enabled } = queue.setAutoplay()

    if (enabled) {
        
        if (!queue.songs.current && !queue.songs.upcoming[0]) { 
            
            let suggestedSong = await queue.songs.previous[0].getSuggestedSong().catch((err) => {
                log('Suggested Song Search Error', err)
                return queue.textChannel.send({ embeds: [WarningEmbed('No more suggested songs could be found.', err.message)], components: [] }).then((msg) => { }).catch()
            })
            if (!suggestedSong) { 
                return 
            }

            queue.songs.current = suggestedSong
            queue.update()

            queue.textChannel.send({ embeds: [queue.songs.current.getEmbed(false, 'np')], components: queue.getPlayButtons(queue.songs.current) }).then((msg) => { if (msg) queue.handleStdButtonIds(msg, queue.songs.current) }).catch()

            queue.play()

         }
        
        return interaction.reply({ embeds: [CreateEmbed('AutoPlay is now enabled.', 'Ducky will infinitely append suggested songs to the upcoming queue.', 'Settings Changed', interaction.member)], components: [] }).catch(() => { })
    }

    else { return interaction.reply({ embeds: [ CreateEmbed('AutoPlay is now disabled.', 'Suggested songs will no longer be appended to the upcoming queue.', 'Settings Changed', interaction.member) ], components: [] }).catch(() => {})  }
}

async function execute_voice(args, queue, user) {

    if (!queue.songs.previous[0] && !queue.songs.current) { return queue.speak('The queue needs to include songs to enable autoplay.') }

    const { enabled } = queue.setAutoplay()

    if (enabled) {
        
        if (!queue.songs.current && !queue.songs.upcoming[0]) { 
            
            let suggestedSong = await queue.songs.previous[0].getSuggestedSong().catch((err) => {
                log('Suggested Song Search Error', err)
                return queue.textChannel.send({ embeds: [WarningEmbed('No more suggested songs could be found.', err.message)], components: [] }).then((msg) => { }).catch()
            })
            if (!suggestedSong) { 
                return 
            }

            queue.songs.current = suggestedSong
            queue.update()

            queue.textChannel.send({ embeds: [queue.songs.current.getEmbed(false, 'np')], components: queue.getPlayButtons(queue.songs.current) }).then((msg) => { if (msg) queue.handleStdButtonIds(msg, queue.songs.current) }).catch()

            queue.play()

        }
        
        else { await queue.speak('Autoplay is now enabled.')  }

    }

    else { queue.speak('Autoplay is now disabled.') }

}

export { command, commandData, execute, execute_voice }