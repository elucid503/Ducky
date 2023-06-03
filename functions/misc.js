'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { getServer } from '../classes/server.js'
import { Routes } from 'discord-api-types/v9'
import { CreateEmbed } from './interface.js'
import { WebhookClient } from 'discord.js'
import { customAlphabet } from 'nanoid'
import Str from '@supercharge/strings'
import { REST } from '@discordjs/rest'
import { DateTime } from 'luxon'
import utils from 'util'
import fs from 'fs' 

export async function checkJoinability(requester, guild, intent = 0) { 

    /* intent 0 = play, intent 1 = connect */

    let queue = process.meta.queues.get(guild.id); let ableToSwitch = false
    if (queue) { if (!queue?.songs?.current) { ableToSwitch = true } }

    let server = await getServer(guild.id, process.meta.client)
    if (!server) { throw new Error(`This server is either not yet cached or stored.\nPlease try again or [contact support](${process.meta.config.misc.links.support}) if this continues.`)}

    if (!requester.voice?.channel) { throw new Error('You must be in a call to use this command.')}
    if (requester.voice?.channel?.id === guild.members?.me?.voice?.channel?.id && intent !== 0) { throw new Error('Ducky is already in your call.')}
    if (intent === 0 && guild.members?.me?.voice?.channel?.id === requester.voice?.channel?.id) { return true }
    if (server.settings.smartJoin && guild.members?.me?.voice?.channel?.id && (guild.members?.me?.voice?.channel?.members.size === 0 || ableToSwitch)) { return true }
    else if (guild.members?.me?.voice?.channel?.id) {
        if (server.settings.smartJoin) throw new Error('Ducky is currently playing music in another call.\nDucky can join your call when the other call is not playing music or is empty.')
        else if (!server.settings.smartJoin && (guild.members?.me?.voice?.channel?.members.size === 0 || ableToSwitch)) { throw new Error(`Ducky is already operating in another call.\n\nTip: it seems like Ducky's call is currently empty or there's no songs playing. Enable the 'Smart Join' setting to bypass this check when Ducky's call has no members.`) }
    }
    if (requester.voice?.channel?.full) { throw new Error('Your call has the maximum amount of members.') }
    if (!requester.voice?.channel?.joinable) { throw new Error(`Your call is locked or not viewable by Ducky.\nPlease update Ducky's roles or permissions to fix this.`)}
    else { return true }

}

export async function checkUsability(requester, guild) { 

    if (!requester.voice?.channel) { throw new Error('You must be in a call to use this command.')}
    if (guild.members?.me?.voice?.channel?.id === requester.voice?.channel?.id) { return true }
    if (guild.members?.me?.voice?.channel?.id && (guild.members?.me?.voice?.channel?.members.size === 0)) { return true }
    else if (guild.members?.me?.voice?.channel?.id) {
        if (server.settings.smartJoin) throw new Error('Ducky is currently playing music in another call.\nYou can control Ducky when the other call is not playing music or is empty.')
        else if (!server.settings.smartJoin && (guild.members?.me?.voice?.channel?.members.size === 0)) { throw new Error(`Ducky is already operating in another call.\n\nTip: it seems like Ducky's call is currently empty or there's no songs playing. Enable the 'Smart Join' setting to bypass this check when Ducky's call has no members.`) }
    }
    else { return true }

}

export async function log(subject, message, startup = false) {
    
    if (!process.meta.config?.misc?.webhook) { return }
    const webhookClient = new WebhookClient({ url: process.meta.config?.misc?.webhook });

    if (process.meta.config.apiKeys.type !== 'beta' && message?.message) { message = message.message }

    if (typeof message === 'object') { message = utils.inspect(message) }

    let date = DateTime.local().toLocaleString(DateTime.TIME_WITH_SECONDS)

    console.log(`${date} • ${subject.toUpperCase()}\n${message}\n──────────────────────────────────────────────`) 

    if (!startup) {
        
        if (process.meta.lastLog) {
            let now = Math.floor(new Date());    
            while (now - process.meta.lastLog < 250) {
                await sleep(100)
                now = Math.floor(new Date())
            }
        }

        await webhookClient.send({ embeds: [CreateEmbed(subject, message, 'New Log Outputted')] }).catch((err) => { console.log('Webhook Error', utils.inspect(err)) })
  
        process.meta.lastLog = Math.floor(new Date())

    }

    return true;

}

export async function updateCommands(guilds, token, client) { 

const type = process.meta.config.botSettings.commandDeployType 

const commands = []; const restrictedCommands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = await import(`../commands/${file}`);
    if (!command.commandData.restricted) { commands.push(command.command) }
    else { restrictedCommands.push(command.command)  }
}

const rest = new REST({ version: '9' }).setToken(token);

    if (type === 'guilds') {

        let addedCounter = 0

        for (const guildId of guilds) { try { if (!process.meta.config.lists.developerServers.includes(guildId)) { await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands }) } else { await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: [...commands, ...restrictedCommands] }) }; addedCounter++ } catch (err) { log('Guild Command Creation Error', utils.inspect(err)) } }

        log('Commands', `Updated commands for ${addedCounter} server(s)`, true)

        return true 
    
    }
        
    else if (type === 'global') { 

        try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands, ...restrictedCommands }) } catch (err) { log('Command Creation Error', utils.inspect(err)) }  

        log('Commands', `Updated global application commands for all servers.`, true)

    }
    
}

export function wordChoice(num, word) { 

    if (num === 1) return word
    else return `${word}s`

}

export async function sleep(ms) { 
    
    return new Promise(resolve => setTimeout(resolve, ms))
    
}

export function limit(string = '', limit = 0, replace = '...') {
    return Str(string)?.limit(limit, replace).get()
}

export function sentenceCase(string = '') { 

    let rg = /(^\w{1}|\.\s*\w{1})/gi;
    let newString = string.replace(rg, function(toReplace) {
        return toReplace.toUpperCase()
    })

    return newString
}

export function formatDur(timeInSeconds) {
    const date = new Date(null);
    date.setSeconds(timeInSeconds);
    const timeString = date.toISOString().substr(11, 8);
    return timeString.replace(/^00:/, ''); 
}
  
export function shuffle(a) { 

    // yeah, this was pasted from stackoverflow; sue me. 

    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;

}

export function getNewInternalID() { 

    const allCreatedIDs = JSON.parse(fs.readFileSync('./resources/idPool.json'))

    const createKey = customAlphabet('1234567890', 18)

    let newID = createKey()

    while (allCreatedIDs.includes(newID)) { newID = createKey() }
    
    allCreatedIDs.push(newID)

    if (process.meta.config.misc.cacheSongs) { fs.writeFileSync('./resources/idPool.json', JSON.stringify(allCreatedIDs)) }

    return newID

}
