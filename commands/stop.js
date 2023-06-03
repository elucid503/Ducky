'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js'
import { CreateEmbed, WarningEmbed } from "../functions/interface.js"
import { checkUsability, log } from '../functions/misc.js'

const command = new Object()
command.name = 'stop'
command.description = `Stop the current and clear the upcoming and previous songs.`
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

    try { queue.stop() } catch (err) { log('Stop Error', err)}
    
    interaction.reply({ embeds: [CreateEmbed('Stopped this server\'s queue.', `The current, previous and all upcoming songs have been cleared.\nAny other settings changed **have been saved**.`, `Playback Controls`, interaction.member)] }).catch((err) => { log('Interaction Error', err) })
    
}

async function execute_voice(args, queue, user) { 

    if (!queue.songs.current) { return await queue.speak('There is nothing currently playing.') }

    queue.stop()
    await queue.speak(`All the queue's songs have been cleared.`)

} 

export { command, commandData, execute, execute_voice }

