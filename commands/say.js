'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType  } from 'discord.js'
import { CreateEmbed, WarningEmbed, ErrorEmbed } from "../functions/interface.js"
import { checkJoinability, log, limit } from '../functions/misc.js'
import { getQueue } from '../classes/queue.js'

const command = new Object()
command.name = 'say'
command.description = `Announce a message in your call.`
command.options = [ { name: "message", description: `Ducky's lifelike voice engine will announce this text to your call.`, min_length: 2, max_length: 300, type: ApplicationCommandOptionType.String, required: true }  ]
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 0

async function execute(interaction, resolvedUser, discordClient) { 

    const text = interaction.options.get('message').value
    let queue;

    try { await checkJoinability(interaction.member, interaction.guild, 0) } catch (error) { 

        let joinableError = String(error.message)
        return interaction.reply({ embeds: [WarningEmbed("You can't use this command right now.", joinableError)], ephemeral: true })

    }

    try {
        queue = await getQueue(interaction.guild.id, interaction.member.voice.channel, interaction.channel, discordClient)
    } catch (err) {
        log('Queue Creation Error', err)
        if (interaction.replied) interaction.editReply({ embeds:[ ErrorEmbed("This server's queue is not fetchable.", `Something prevented Ducky from getting a queue for this server.\nPlease [contact support](${process.meta.support}) if this continues.`)], components: [] })
        else interaction.reply({ embeds: [ErrorEmbed("This server's queue is not fetchable.", `Something prevented Ducky from getting a queue for this server.\nPlease [contact support](${process.meta.support}) if this continues.`)], components: [], ephemeral: true })
        return
    }

    if (!interaction.guild.members?.me?.voice?.channel?.id) {
        try { await queue.connect(true) } catch (err) {
            log('Connection Error', err)
            if (interaction.replied) interaction.editReply({ embeds: [ErrorEmbed("Ducky could not connect to your call.", `Something prevented Ducky from connecting to your call.\nPlease [contact support](${process.meta.support}) if this continues.`)], components: [] })
            else interaction.reply({ embeds: [ErrorEmbed("Ducky could not connect to your call.", `Something prevented Ducky from connecting to your call.\nPlease [contact support](${process.meta.support}) if this continues.`)], components: [], ephemeral: true })
            return
        }
    }

    interaction.reply({ embeds: [CreateEmbed(`Now saying "${limit(text, 100)}"`, `Any interrupted audio will resume when your message is finished.\nText to speech acts as a queue. Older messages may play first.`, 'Text To Speech', interaction.member)], components: [], ephemeral: true  }).catch((err) => { log('Interaction Error', err )})

    try { await queue.speak(`${interaction.member.displayName || interaction.member.user.username} says ${text}`) } catch (err) {
        log('TTS Error', err)
        interaction.editReply({ embeds: [ErrorEmbed("Ducky could not synthesize this message.", `Something prevented Ducky from creating an audio stream.\nPlease [contact support](${process.meta.support}) if this continues.`)], components: [], ephemeral: true  }).catch((err) => { log('Interaction Error', err )})
        return
    }
    
}

export { command, commandData, execute }