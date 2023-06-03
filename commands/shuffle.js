'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType  } from 'discord.js'
import { CreateEmbed, WarningEmbed } from "../functions/interface.js"
import { log } from "../functions/misc.js"

const command = new Object()
command.name = 'shuffle'
command.description = `Shuffle all the upcoming songs in the queue once or recurringly.`
command.options = [ { name: "mode", description: 'Choose if Ducky continues to shuffle upcoming songs with each new song playing.', choices: [ { name: 'Only Once', value: 'once' }, { name: 'Recurring', value: 'recurring' } ], type: ApplicationCommandOptionType.String, required: true }  ]
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 0

async function execute(interaction, resolvedUser, discordClient) { 

    let mode = interaction.options.get('mode').value
    if (mode === 'once') { mode = false } else { mode = true }

    let queue = process.meta.queues.get(interaction.guild.id)
    if (!queue) { return interaction.reply({ embeds: [WarningEmbed("Ducky is not playing anything in this server.", `To control playback, join a voice channel and play a song first.`)], components: [], ephemeral: true }).catch(() => {})  }

    try { await checkUsability(interaction.member, interaction.guild) } catch (error) { 

        let joinableError = String(error.message)
        return interaction.reply({ embeds: [WarningEmbed("You can't use this command right now.", joinableError)], ephemeral: true })

    }

    try { queue.shuffle(mode) } catch (err) { log('Shuffle Error', err)}
    
    return interaction.reply({ embeds: [CreateEmbed('Shuffled this server\'s upcoming songs.', `${mode ? 'Upcoming songs will continue to be shuffled when a new song is played.' : 'The queue will not be automatically shuffled.'}`, 'Playback Controls', interaction.member) ] })
    
}

export { command, commandData, execute }