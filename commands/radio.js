'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType  } from 'discord.js'
import { CreateEmbed, WarningEmbed, ErrorEmbed } from "../functions/interface.js"
import { checkJoinability, log } from '../functions/misc.js'
import { getQueue } from '../classes/queue.js'

const stationChoices = new Array()
for (let [key, val] of Object.entries(process.meta.config.radios)) { 
    stationChoices.push({ name: val.name, value: val.name.toLowerCase().split(' ').join('-') })
}

const command = new Object()
command.name = 'radio'
command.description = `Listen to one of Ducky's custom radio stations.`
command.options = [ { name: "station", description: `Choose which genre to listen to.`, choices: [ { name: 'Stop Listening', value: 'stop'}, ...stationChoices], type: ApplicationCommandOptionType.String, required: true }  ]
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 0

async function execute(interaction, resolvedUser, discordClient) { 

    const radio = interaction.options.get('station').value
    const radioInfo = process.meta.radios[radio]
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

    if (!radioInfo) { 

        queue.switchPlayer('music')
    
        await interaction.reply({ embeds: [ CreateEmbed(`Stopped listening to Ducky radio.`, `The default music player is now active.`, 'Ducky Radio', interaction.member) ] }).catch(((err) => { log("Interaction Error" )}))
        return
    }

    queue.switchPlayer(radioInfo.backendName, radioInfo.player)
    
    await interaction.reply({ embeds: [ CreateEmbed(`Now listening to "${radioInfo.name}"`, `${radioInfo.description}\nTo stop listening, play any song or select "Stop Listening"`, 'Ducky Radio', interaction.member) ] }).catch(((err) => { log("Interaction Error" )}))
    
}

export { command, commandData, execute }