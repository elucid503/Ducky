'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType, AttachmentBuilder } from 'discord.js'
import { CreateEmbed } from "../functions/interface.js"
import { writableQueue } from '../classes/queue.js'
import user from '../classes/user.js'
import { limit, wordChoice } from '../functions/misc.js'
import { exec } from 'child_process'
import path from 'path'
import util from 'util'
import fs from 'fs'

const promiseExec = util.promisify(exec)

const command = new Object()
command.name = 'debug'
command.description = `[Restricted] Debug the current shard, using actions such as logging, evalulation and commands.`
command.options = [ { name: "action", description: 'Specify an action for Ducky to execute.', choices: [ { name: 'Log This Guild\'s Queue', value: 'logqueue' }, { name: 'Reload Config JSONs', value: 'reloadsettings' }, { name: 'Show All Connections', value: 'showconnections' }, { name: 'Update Files from Repo', value: 'updategit' }, { name: 'Restart (Power Action)', value: 'restart' }, { name: 'Kill Process (Power Action)', value: 'prockill' }, { name: 'Remove All Notifications', value: 'notifremove' } ], type: ApplicationCommandOptionType.String, required: true }  ]
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.openlyRestricted = true
commandData.restricted = false
commandData.cooldown = 0

async function execute(interaction, resolvedUser, discordClient) { 

    const selectedAction = interaction.options.get('action')?.value
    if (!selectedAction) { throw new Error('DiscordJS did something stupid.') }

    let description = new String(); let attachments = new Array()

    if (selectedAction === 'logqueue') { 

        let currentQueue = process.meta.queues.get(interaction.guild.id) || { error: true, message: 'There is no queue for this guild.' }
        let buffer = (!currentQueue?.error) ? Buffer.from(JSON.stringify(new writableQueue(currentQueue), null, 2)) : Buffer.from(JSON.stringify(currentQueue), null, 2)
        attachments.push(new AttachmentBuilder(buffer, { name: `${interaction.guild.id}-queue.json` }))
        console.log(currentQueue)
        description = null

    }

    if (selectedAction === 'reloadsettings') { 

        const configFiles = fs.readdirSync('./config')
        let totalReloaded = 0

        for (const file of configFiles) {
            let name = path.basename(file, '.json')
            const content = JSON.parse(fs.readFileSync('./config/' + file))
            process.meta.config[name] = content
            totalReloaded += 1
        }
        
        description = `Reloaded ${totalReloaded} top-level config values.`

    }

    if (selectedAction === 'showconnections') { 

        let toJoin = new Array()

        process.meta.queues.forEach((queue, guildID) => {

            let guild = process.meta.client.guilds.cache.get(guildID) || queue.textChannel?.guild?.id || { name: 'Unknown' }
            toJoin.push(`> Queue For: ${guild.name}\n> Queue ID: ${guild.id}\n> Connected: ${queue?.connection ? 'Yes' : 'No'}`)

        })

        if (toJoin.length < 1) { description = 'There are no current connections.' }
        else { description = toJoin.join('\n\n') } 

    }

    if (selectedAction === 'updategit') { 

        let resp = await promiseExec(`git pull https://github.com/elucid503/ducky-2`)

        description = limit(resp.stdout, 500)
        
    }

    if (selectedAction === 'restart') { 

        await interaction.reply({ embeds: [CreateEmbed('This debug action is in progress.', 'As a limitation, Ducky cannot update this message as it is now restarting.', 'Developer Features', interaction.member)], files: attachments }).catch((err) => { console.error(err) })
        
        process.exit()

    }

    if (selectedAction === 'prockill') { 

        await interaction.reply({ embeds: [CreateEmbed('This debug action is in progress.', 'As a limitation, Ducky cannot update this message as it is now offline.', 'Developer Features', interaction.member)], files: attachments }).catch((err) => { console.error(err) })
        
        promiseExec(`forever stop index.js`, { cwd: process.cwd() })
        
        return 

    }

    if (selectedAction === 'notifremove') { 

        let allUsers = fs.readdirSync('./data/users')
   
        let count = 0
            
        for (const returnedUserPath of allUsers) {
    
            let returnedUser = JSON.parse(fs.readFileSync(`./data/users/${returnedUserPath}`))
            
            let newResolvedUser = new user(returnedUser)
    
            if (newResolvedUser.error) { return }
    
            newResolvedUser.inbox = { notifications: [], alerts: [], outages: [] }

            fs.writeFileSync(`./data/users/${returnedUserPath}`, JSON.stringify(newResolvedUser))

            count ++ 
    
        }
    
        description = `Cleared all notifications from ${count} ${wordChoice(count, 'user')}.`

    }


    let embeds = new Array()
    if (description) { embeds.push(CreateEmbed('This debug action has completed.', description, 'Developer Features', interaction.member)) }
    interaction.reply({ embeds: embeds, files: attachments }).catch((err) => { console.error(err) })
    
}

export { command, commandData, execute }