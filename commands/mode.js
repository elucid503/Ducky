'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType  } from 'discord.js'
import { CreateEmbed, WarningEmbed } from "../functions/interface.js"
import { checkUsability, log } from '../functions/misc.js'

const command = new Object()
command.name = 'mode'
command.description = `Switch between karaoke mode, normal mode and spatial audio.`
command.options = [ { name: "mode", description: 'The mode to switch to. When switching, all other active modes will be disabled.', choices: [ { name: 'Normal', value: 'normal' }, { name: 'Dynamic', value: 'dynamic' },{ name: 'Enhanced', value: 'spatial' }  ], type: ApplicationCommandOptionType.String, required: true }  ]
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 10

async function execute(interaction, resolvedUser, discordClient) { 

    let queue = process.meta.queues.get(interaction.guild.id)
    const mode = interaction.options.get('mode').value
    if (!queue || !queue?.songs?.current) { return interaction.reply({ embeds: [WarningEmbed("Ducky is not playing anything in this server.", `To control playback, join a voice channel and play a song first.`)], components: [], ephemeral: true }).catch(() => { }) }
    
    try { await checkUsability(interaction.member, interaction.guild) } catch (error) { 

        let joinableError = String(error.message)
        return interaction.reply({ embeds: [WarningEmbed("You can't use this command right now.", joinableError)], ephemeral: true })

    }

    let modeResp
    try { modeResp = queue.switchMode(mode) } catch (err) { log('Skip Error', err)}
    
    if (modeResp.normal) { return interaction.reply({ embeds: [CreateEmbed('Returned to **normal** mode.', `Playback will have no effects or changes.`, 'Mode Switching', interaction.member) ] })}
    else if (modeResp.spatial) { return interaction.reply({ embeds: [CreateEmbed('Enabled **enhanced** mode.', `Sound will be rendered in 3D for an enhanced experience.`, 'Mode Switching', interaction.member) ] })}
    else if (modeResp.dynamic) { return interaction.reply({ embeds: [CreateEmbed('Enabled **dynamic** mode.', `Volume will adapt to coversations within your call.`, 'Mode Switching', interaction.member) ] })}

}

export { command, commandData, execute }