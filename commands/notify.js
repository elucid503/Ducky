'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType  } from 'discord.js'
import { CreateEmbed } from "../functions/interface.js"
import { wordChoice } from "../functions/misc.js"
import user from '../classes/user.js'
import fs from 'fs'

const command = new Object()
command.name = 'notify'
command.description = `[Restricted] Create new messages to add to user inboxes.`
command.type = ApplicationCommandType.ChatInput
command.options = [
    { name: "type", description: 'The type of message that will be added.', type: ApplicationCommandOptionType.String, choices: [{ name: 'Notification', value: '0' }, { name: 'Alert', value: '1' }, { name: 'Outage', value: '2' } ], required: true },
    { name: "title", description: 'The title of the new message.', type: ApplicationCommandOptionType.String, required: true },
    { name: "description", description: 'The description of the new message. (Accepts line breaks and markdown)', type: ApplicationCommandOptionType.String, required: true },
    { name: "image", description: 'An optional image to add to the new message.', type: ApplicationCommandOptionType.String, required: false },
]

const commandData = new Object()
commandData.private = false
commandData.openlyRestricted = true
commandData.restricted = false
commandData.cooldown = 0

async function execute(interaction, resolvedUser, discordClient) { 

    const type = interaction.options.get('type').value
    const title = interaction.options.get('title').value
    const description = interaction.options.get('description').value.replace(/\\n/g, '\n')
    const image = interaction.options.get('image')?.value
        
    let allUsers = fs.readdirSync('./data/users')
   
    let count = 0
    
    let updateInterval = setInterval(async () => {

        await interaction.reply({ embeds: [ CreateEmbed(`Sending a new message to ${allUsers.length} ${wordChoice(allUsers.length, 'user')}`, `Sent this notification to ${count} / ${allUsers.length} ${wordChoice(allUsers.length, 'user')}.`, 'User Inbox Management', interaction.member) ] })

     }, 2500) 

    for (const returnedUserPath of allUsers) {

        let returnedUser = JSON.parse(fs.readFileSync(`./data/users/${returnedUserPath}`))
        
        let newResolvedUser = new user(returnedUser)

        if (newResolvedUser.error) { return }

        await newResolvedUser.addToInbox(parseInt(type), title, description, image)
        count ++ 

    }

    clearInterval(updateInterval)
    if (interaction.replied) await interaction.editReply({ embeds: [ CreateEmbed(`Finished sending a new message to ${allUsers.length} ${wordChoice(allUsers.length, 'user')}`, `Sent this notification to all users.`, 'User Inbox Management', interaction.member) ] })
    else await interaction.reply({ embeds: [ CreateEmbed(`Finished sending a new message to ${allUsers.length} ${wordChoice(allUsers.length, 'user')}`, `Sent this notification to all users.`, 'User Inbox Management', interaction.member) ] })

}

export { command, commandData, execute }