'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ActionRowBuilder, ButtonStyle, ButtonBuilder  } from 'discord.js'
import { CreateEmbed } from "../functions/interface.js";
import { log } from "../functions/misc.js"
import fs from 'fs'

const command = new Object()
command.name = 'purge'
command.description = `Delete and leave no trace of your data on Sprout Software's servers.`
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 0

async function execute(interaction, resolvedUser, discordClient) { 

    let filePath = `./data/users/${interaction.member.id}.json`

    const components = new ActionRowBuilder().addComponents(new ButtonBuilder().setEmoji(process.meta.config.botSettings.buttons.affirm).setCustomId('yes').setStyle(ButtonStyle.Secondary)).addComponents(new ButtonBuilder().setEmoji('1024086708490346597').setCustomId('no').setStyle(ButtonStyle.Secondary))
    interaction.reply({ embeds: [CreateEmbed('Are you sure you want to delete all your data?', 'This will result in Ducky losing track of important stats on your usage, such as how many commands you\'ve ran, how many songs you\'ve played and more.\n**This will also result in all your libraries being removed!**\nIf you have your Spotify account synced, that will also be reset.', 'Data Management', false, '102408')], ephemeral: true, components: [ components ] }).catch((err) => { log('Interaction Err', err)}).then((msg) => { handleAffirm(msg) })

    function handleAffirm(msg) {

        let collector = msg.createMessageComponentCollector({ time: 3600000 })

        collector.on('collect', async (childInt) => {

            let id = childInt.customId
            await childInt.deferUpdate().catch((err) => { log('Button Defer Error', err) })

            if (id === 'yes') {

                try { fs.unlinkSync(filePath) } catch (err) { log('File Remove Error', err) }

                return interaction.editReply({ embeds: [CreateEmbed('Your data has now been removed.', `All your previous data has been permanently removed.\nAlthough using Ducky again in the future will always result in some data being stored, your previous data will never be accessable again.`, 'Data Management', false, 'f21562') ], ephemeral: true })

            }

            else if (id === 'no') {

                return interaction.editReply({ embeds: [CreateEmbed('Your data has **not** been removed.', `If you have further questions about how Ducky handles your data, please feel free to ask [support](${process.meta.config.misc.links.support}).`, 'Data Management', false, 'f21562') ], ephemeral: true })

            }

        })

     }

}

export { command, commandData, execute }