'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { CreateEmbed } from "../functions/interface.js"
import { ApplicationCommandType  } from 'discord.js'

const command = new Object()
command.name = 'ping'
command.description = `Checks Ducky's latency to the Discord API.`
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 0

async function execute(interaction, resolvedUser, discordClient) { 

    const ping = discordClient.ws.ping
    await interaction.reply({ embeds: [ CreateEmbed('Discord API Latency', `Ducky's websocket ping is **${ping}ms**.`, 'Stats and Monitoring', interaction.member) ] }).catch((err) => { })
    
}

export { command, commandData, execute }