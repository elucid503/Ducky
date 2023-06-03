'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType, AttachmentBuilder } from 'discord.js'
import { CreateEmbed } from "../functions/interface.js"
import path from 'path'
import fs from 'fs'

const command = new Object()
command.name = 'whitelist'
command.description = `[Restricted] Add and remove guilds from the beta whitelist.`
command.options = [  { name: "guild-id", description: 'The ID of the guild to change.', type: ApplicationCommandOptionType.String, required: true } , { name: "action", description: 'The action to take on this guild.', choices: [ { name: 'Add to Whitelist', value: 'add-w' }, { name: 'Remove from Whitelist', value: 'remove-w' }, { name: 'Add to Blacklist', value: 'add-b' },{ name: 'Remove from Blacklist', value: 'remove-b' }, ], type: ApplicationCommandOptionType.String, required: true }  ]
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.openlyRestricted = true
commandData.restricted = false
commandData.cooldown = 0

async function execute(interaction, resolvedUser, discordClient) { 

    const guildId = interaction.options.get('guild-id')?.value
    const action = interaction.options.get('action')?.value

    let description = new String(); 

    const lists = JSON.parse(fs.readFileSync('./config/lists.json'))

    if (action === 'add-w') { 

        lists.betaServers.push(guildId)
        description = `Added guild ID ${guildId} to the beta whitelist.`

    }

    if (action === 'remove-w') { 
        
        lists.betaServers.splice(lists.betaServers.indexOf(guildId), 1)
        description = `Removed guild ID ${guildId} from the beta whitelist.`


    }

    if (action === 'add-b') { 

        lists.blacklistedGuilds.push(guildId)
        description = `Added guild ID ${guildId} to the blacklist.`

    }

    if (action === 'remove-b') { 

        lists.blacklistedGuilds.splice(lists.blacklistedGuilds.indexOf(guildId), 1)
        description = `Removed guild ID ${guildId} from the blacklist.`

    }

    fs.writeFileSync('./config/lists.json', JSON.stringify(lists, null, 2))

    const configFiles = fs.readdirSync('./config')
    let totalReloaded = 0

    for (const file of configFiles) {
        let name = path.basename(file, '.json')
        const content = JSON.parse(fs.readFileSync('./config/' + file))
        process.meta.config[name] = content
        totalReloaded += 1
    }
    
    description = `${description}\nReloaded ${totalReloaded} top-level config values.`

    let embeds = new Array()
    if (description) { embeds.push(CreateEmbed('This developer action has completed.', description, 'Developer Features', interaction.member)) }
    interaction.reply({ embeds: embeds }).catch((err) => { console.error(err) })
    
}

export { command, commandData, execute }