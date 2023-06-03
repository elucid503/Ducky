'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { CreateEmbed, ErrorEmbed, WarningEmbed } from "../functions/interface.js"
import { checkJoinability, log } from '../functions/misc.js'
import { getQueue } from '../classes/queue.js'

const command = new Object()
command.name = 'connect'
command.description = `Connect Ducky to the voice channel you're in.`
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 0

async function execute(interaction, resolvedUser, discordClient) { 
    
    try { await checkJoinability(interaction.member, interaction.guild, 1) } catch (error) { 

        let joinableError = String(error.message)
        return interaction.reply({ embeds: [WarningEmbed("You can't use this command right now.", joinableError)], ephemeral: true })

    }

    // create row of buttons 
    
    const buttonRow = new ActionRowBuilder()
        .addComponents(new ButtonBuilder()
            .setEmoji(process.meta.config.botSettings.buttons.dc)
            .setCustomId('disconnect')
            .setStyle(ButtonStyle.Secondary))
        .addComponents(new ButtonBuilder()
            .setEmoji(process.meta.config.botSettings.buttons.forget)
            .setCustomId('forget')
            .setStyle(ButtonStyle.Secondary))
        
    let queue; 
    
    try {
        queue = await getQueue(interaction.guild.id, interaction.member.voice.channel, interaction.channel, discordClient)

        await interaction.reply({ embeds: [CreateEmbed(`Connected to ${interaction.member.voice.channel.name}`, `Text updates are bound to ${interaction.channel}\nDucky is also listening for voice requests.`, `Voice Session Started`, interaction.member)], components: [ buttonRow ] }).then((msg) => { if (msg) queue.handleStdButtonIds(msg) }).catch(() => { })

    } catch (err) {
        log('Queue Creation Error', err)
        if (interaction.replied) interaction.editReply({ embeds:[ ErrorEmbed("This server's queue is not fetchable.", `Something prevented Ducky from getting a queue for this server.\nPlease [contact support](${process.meta.support}) if this continues.`)], components: [] })
        else interaction.reply({ embeds: [ErrorEmbed("This server's queue is not fetchable.", `Something prevented Ducky from getting a queue for this server.\nPlease [contact support](${process.meta.support}) if this continues.`)], components: [], ephemeral: true })
        return
    }

    try { await queue.connect() } catch (err) { 
        log('Connection Error', err)
        if (interaction.replied) interaction.editReply({ embeds:[ ErrorEmbed("Ducky could not connect to your call.", `Something prevented Ducky from connecting to your call.\nPlease [contact support](${process.meta.support}) if this continues.`) ], components: []})
        else interaction.reply({ embeds: [ErrorEmbed("Ducky could not connect to your call.", `Something prevented Ducky from connecting to your call.\nPlease [contact support](${process.meta.support}) if this continues.`)], components: [], ephemeral: true })
        return
    }

}

export { command, commandData, execute }