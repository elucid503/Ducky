'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { Client, GatewayIntentBits, Collection, InteractionType, ActivityType } from 'discord.js';
import fs from 'fs'; import utils from 'util'; import path from 'path';

import { CreateEmbed, ErrorEmbed, WarningEmbed } from './functions/interface.js'
import { log, updateCommands } from './functions/misc.js'
import { clearTemp } from './functions/data.js'
import { getUser } from './classes/user.js'
import radios from './radios.js'

process.meta = new Object(); process.meta.config = new Object()
process.meta.lastLog = null
const configFiles = fs.readdirSync('./config')

for (const file of configFiles) {
    let name = path.basename(file, '.json')
    const content = JSON.parse(fs.readFileSync('./config/' + file))
    process.meta.config[name] = content
}

log('Startup', 'Ducky, Developed by Elucid', true)
log('Startup', 'Ducky has been started and is in startup')

process.meta.queues = new Collection()
process.meta.support = process.meta.config.misc.links.support

log('Startup', 'Loaded all config file values', true)
log('Version', `Running build ${process.meta.config.botSettings.version}`, true)

process.on('SIGINT', async () => {

    await log('Shutting Down', `Ducky's parent process is exiting`)

    process.meta.queues.forEach(async (queue, guildID) => {

        try { await queue.connection.destroy() } catch { }

    })

    process.exit()

})
 
process.on('unhandledRejection', async (err) => { 

    await log('Error', err)

})

process.on('uncaughtException', async (err) => { 

    await log('Error', err)

})

clearTemp()
setInterval(() => { try { clearTemp() } catch (err) { log('Clear Temp Error', err) } }, 3600000)

log('Database', 'Removed all items in the temp directory', true)

radios()

const discordClient = new Client({ intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates ] })
let token = process.meta.config.apiKeys.betaToken
if (process.meta.config.apiKeys.type !== 'beta') { token = process.meta.config.apiKeys.publicToken }

discordClient.login(token);
process.meta.client = discordClient

discordClient.on('error', (err) => { log('Discord API Error', err)})

log('Connecting', "Initiated Ducky's websocket connection", true)

const discordCommands = new Collection()
const voiceCommands = new Collection()
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = await import(`./commands/${file}`);
    discordCommands.set(command.command.name, command);
    voiceCommands.set(command.command?.voiceName || command.command.name, command)
}

process.meta.voiceCommands = voiceCommands

log('Commands', 'Loaded application commands', true)

discordClient.once('ready', async () => {
    
    log('Connected', "Ducky has connected to Discord", true);

    discordClient.user.setActivity(process.meta.config.botSettings.status, { type: ActivityType.Playing })
    
    const guilds = discordClient.guilds.cache.map(guild => guild.id);
    await updateCommands(guilds, token, discordClient) // Move to global on release channel
    log('Started', 'Started and ready for commands')
    
})

discordClient.on('guildCreate', async (guild) => {
    
    let interptetedGuildArr = [ guild.id ]
    
    try { if (process.meta.config.botSettings.commandDeployType === 'guilds') { await updateCommands(interptetedGuildArr, token, discordClient) }
    log('New Server', `Ducky has been added to ${guild.name}.`) } catch (err) { log('Guild Join Error', err) }

 })

discordClient.on('voiceStateUpdate', async (oldUser, newUser) => {

    if (newUser.id !== discordClient.user.id) { return }
    
    let queue = process.meta.queues.get(newUser.guild.id)
    if (!queue) { return }
    
    if (!oldUser.serverDeaf && newUser.serverDeaf) {
        queue.textChannel.send({ embeds: [ CreateEmbed('Voice Interactions are now disabled.', 'Ducky has detected that it has been deafened.\nVoice Interactions will be unavailable until Ducky is undeafened.', 'System Notifications')] }).catch((err) => { log("Message Send Error", err)})
    }
    if (oldUser.serverDeaf && !newUser.serverDeaf) { 
        queue.textChannel.send({ embeds: [ CreateEmbed('Voice Interactions have been re-enabled.', 'Ducky has detected that it has been undeafened.\nVoice Interactions are now available to use.', 'System Notifications')] }).catch((err) => { log("Message Send Error", err)})
    }
    if (!oldUser.serverMute && newUser.serverMute) { 
        queue.textChannel.send({ embeds: [ CreateEmbed('The queue is now paused.', 'Ducky has detected that it has been server-muted.', 'System Notifications')] }).catch((err) => { log("Message Send Error", err)})
        queue.pause()
    }
    if (oldUser.serverMute && !newUser.serverMute) { 
        queue.textChannel.send({ embeds: [ CreateEmbed('The queue has been resumed.', 'Ducky has detected that it has been unmuted.', 'System Notifications')] }).catch((err) => { log("Message Send Error", err)})
        queue.resume()
    }

})

discordClient.on('interactionCreate', async interaction => {
	
    if (interaction.type === InteractionType.MessageComponent || interaction.type === InteractionType.ApplicationCommandAutocomplete) { 
        if (interaction.type === InteractionType.MessageComponent) { log('Component Click', `${interaction.member.user.tag} used [${interaction.customId}] in ${interaction.guild.name}`) }
        
        setTimeout(async () => { 

            if (interaction.deferred || interaction.replied) { } 
            else {
                await interaction.deferUpdate().catch(() => { }) 
                interaction.followUp({ embeds: [WarningEmbed('This button has expired.', 'Ducky saves resources by recycling old interaction listeners.\nIf this button was sent recently, Ducky may have restarted.')], ephemeral: true })
            }

        }, 2850)
        
        return
    };

	const command = discordCommands.get(interaction.commandName);
	if (!command) { return };

    try {
        
        if (process.meta.config.apiKeys.type === 'beta' && !process.meta.config.lists.betaServers.includes(interaction.guild.id)) { return interaction.reply({ embeds: [WarningEmbed('This server does not have access to this version of Ducky, yet.', `If you want to request access to an accelerated version of Ducky, use [this forum.](${process.meta.config.misc.links.betaForm})`)], ephemeral: true }) }

        let resolvedUser = await getUser(interaction.member.user.id, discordClient)
        
        let cooldown = await resolvedUser.checkCooldown(interaction.commandName)

        if (cooldown.isActive) { return interaction.reply({ embeds: [WarningEmbed('You are being time restricted from this action.', `You can use this command again starting at <t:${cooldown.expiry}:T>`)], ephemeral: true }) }

        if (command.commandData.cooldown > 0) { await resolvedUser.addCooldown(interaction.commandName, command.commandData.cooldown) }
        
        if ((command.commandData.restricted || command.commandData.openlyRestricted) && !resolvedUser.developer) { return interaction.reply({ embeds: [WarningEmbed(`This command is restricted to Ducky's developers`, `If you know what you're doing, consider learning more about [contributing to Ducky](${process.meta.config.misc.links.site}).`)], ephemeral: true }) }

        log('Command Used', `${interaction.member.user.tag} used /${interaction.commandName} in ${interaction.guild.name}`)
        resolvedUser.displayNotifications(interaction)
        resolvedUser.increment()

        setTimeout(() => { 

            if (interaction.replied) { } 
            else {
                command.commandData.private ? interaction.deferReply({ ephemeral: true }).catch(() => {}) : interaction.deferReply().catch(() => { })
            }

        }, 2850)

        await command.execute(interaction, resolvedUser, discordClient, resolvedUser);

    } catch (error) {
        log('Command Error', utils.inspect(error))
        try { await interaction.reply({ embeds: [ErrorEmbed('An unknown exception occured while executing this command.', `This error could come from multiple things.\nPlease contact [support](${process.meta.config.misc.links.support}) if it continues.\n\nThe raw error is below. If requested, please present it to Ducky's developers.` + '```js\n' + error + '```')], ephemeral: true }).catch((err) => { interaction.editReply({ embeds: [ ErrorEmbed('A wild error has appeared!', `This error could come from multiple things.\nPlease contact [support](${process.meta.config.misc.links.support}) if it continues.\n\nThe raw error is below. This is here to help Ducky's developers.` + '```js\n' + error + '```') ] })  }) } catch { }
    }
    
});