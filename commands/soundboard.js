'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle  } from 'discord.js'
import { CreateEmbed, WarningEmbed, ErrorEmbed } from "../functions/interface.js"
import { checkJoinability, log, limit } from '../functions/misc.js'
import { soundboard } from '../classes/playlist.js'
import { getQueue } from '../classes/queue.js'
import { getUser } from '../classes/user.js'
import play from 'play-dl'

const command = new Object()
command.name = 'soundboard'
command.description = `Play breif effects in your call to lighten the mood.`
command.options = [ ]
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = true
commandData.restricted = false
commandData.cooldown = 0

async function execute(interaction, resolvedUser, discordClient) { 

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

    let buttons_0 = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.main.play).setCustomId('0')).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.main.play).setCustomId('1')).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.main.play).setCustomId('2')).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.main.play).setCustomId('3')).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.main.play).setCustomId('4'))
    let buttons_1 = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.settings).setCustomId('edit_0')).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.settings).setCustomId('edit_1')).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.settings).setCustomId('edit_2')).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.settings).setCustomId('edit_3')).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.settings).setCustomId('edit_4'))

    const sounds = new Array(); let index = 0
    for (const [key, val] of Object.entries(resolvedUser.soundboard)) { 

        index += 1
        sounds.push(`Slot ${index}: ${limit(val.name, 25, '...')}`)
    }

    await interaction.reply({ embeds: [ CreateEmbed(`${interaction.member.user.username}'s Soundboard`, `Use any of the <:play:${process.meta.config.botSettings.buttons.main.play}> buttons to use the slot's stored sound.\nUse the <:settings:${process.meta.config.botSettings.buttons.settings}> button below to customize the slot's sound.\n\n${sounds.join('\n')}`, 'Audio Effects', interaction.member)], components: [buttons_0, buttons_1], ephemeral: true }).then((msg) => { handleSoundboard(msg) }).catch((err) => { log("interaction Error", err) })

    if (resolvedUser.checkCTA('soundboard')) {
        interaction.followUp({ embeds: [resolvedUser.getCTA('soundboard')], ephemeral: true }).catch(async (err) => {
            log("CTA Error", err)
        })
    }

    function handleSoundboard(msg) { 

        let collector = msg.createMessageComponentCollector({ time: 3600000 })

        collector.on('collect', async (childInt) => {

            let id = childInt.customId

            if (id.includes('edit')) { 

                resolvedUser = await getUser(childInt.member.user.id, discordClient)

                let editableId = id.charAt(id.length - 1)

                const modal = new ModalBuilder().setCustomId('changeSound').setTitle('Change Sound Effect')
        
                const urlInput = new TextInputBuilder().setCustomId('url').setLabel("Enter a YouTube URL for your new sound.").setStyle(TextInputStyle.Short).setRequired(true).setMinLength(5)
                const nameInput = new TextInputBuilder().setCustomId('name').setLabel("Enter a name for your new sound.").setStyle(TextInputStyle.Short).setRequired(true).setMinLength(3).setMaxLength(20)

                const urlRow = new ActionRowBuilder().addComponents(urlInput)
                const nameRow = new ActionRowBuilder().addComponents(nameInput)
                modal.addComponents(urlRow, nameRow)
                childInt.showModal(modal)

                childInt.awaitModalSubmit({ time: 300000 })
                    
                .then(async (modalInt) => {

                    let ignore 

                    try { await modalInt.deferUpdate() } 
                    catch { ignore = true }

                    if (ignore) { return }

                    const url = modalInt.fields.getTextInputValue('url')
                    const name = modalInt.fields.getTextInputValue('name')

                    const videoInfo = await play.video_basic_info(url).catch((err) => { })

                    if (!videoInfo || videoInfo?.video_details?.durationInSec > 10) { 

                        await modalInt.followUp({ embeds: [WarningEmbed('This video lacks the soundboard requirements.', 'This video either does not exist or is over 10 seconds in length.')], ephemeral: true }).catch((err) => { log('Interaction Error', err) })
                        return 

                    }

                    const usrSoundboard = new soundboard(resolvedUser.soundboard)
                    usrSoundboard.changeSound(editableId, videoInfo?.video_details?.url || url, resolvedUser, name || videoInfo?.video_details?.title)
                    await modalInt.followUp({ embeds: [CreateEmbed('Changed this soundboard effect.', `**${videoInfo?.video_details?.title}** has been assigned to this slot.`, `${childInt.user.username}'s Soundboard`, childInt.member)], ephemeral: true }).catch((err) => { log('Interaction Error', err) })

                    resolvedUser = await getUser(interaction.member.user.id, process.meta.client)

                    const sounds = new Array(); let index = 0
                    for (const [key, val] of Object.entries(resolvedUser.soundboard)) { 
                
                        index += 1
                        sounds.push(`Slot ${index}: ${limit(val.name, 25, '...')}`)
                    }
                
                    childInt.message.edit({ embeds: [ CreateEmbed(`${interaction.member.user.username}'s Soundboard`, `Use any of the <:play:${process.meta.config.botSettings.buttons.main.play}> buttons to use the slot's stored sound.\nUse the <:settings:${process.meta.config.botSettings.buttons.settings}> button below to customize the slot's sound.\n\n${sounds.join('\n')}`, 'Audio Effects', interaction.member)], components: [buttons_0, buttons_1] }).catch((err) => { log("interaction Error", err) })
                

                })

            }

            else { 
               
                childInt.deferUpdate().catch((err) => { })

                let playableId = id

                resolvedUser = await getUser(childInt.member.user.id, discordClient)

                const usrSoundboard = new soundboard(resolvedUser.soundboard)

                await usrSoundboard.playSound(queue, playableId)

            }


        })

    }


}


export { command, commandData, execute }