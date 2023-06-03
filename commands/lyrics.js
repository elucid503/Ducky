'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ActionRowBuilder, ButtonBuilder, ButtonStyle  } from 'discord.js'
import { CreateEmbed, ErrorEmbed, WarningEmbed } from "../functions/interface.js"
import { getUser } from '../classes/user.js'
import { log } from '../functions/misc.js'

const command = new Object()
command.name = 'lyrics'
command.description = `View interactive lyrics derived from the current song.`
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 10

async function execute(interaction, resolvedUser, discordClient) { 

    let queue = process.meta.queues.get(interaction.guild.id)
    if (!queue) { return interaction.reply({ embeds: [WarningEmbed("Ducky is not playing anything in this server.", `To view lyrics, join a voice channel and play a song first.`)], components: [], ephemeral: true }).catch(() => {})  }
    if (!queue.songs.current) { return interaction.reply({ embeds: [WarningEmbed("There is no song currently playing.", `To view lyrics, a song must be playing first.`)], components: [], ephemeral: true }).catch(() => { }) }
    if (!queue.songs.current.ids.spID) { return await interaction.reply({ embeds: [WarningEmbed(`Time-Synced Lyrics aren't offered for this track, yet.`, `Check back soon - new lyrics are being constantly sourced!`)], ephemeral: true }).catch((err) => { log('Interaction Error', err) }) }

    if (queue.lyrics.lyricsInProgress) { return await interaction.reply({ embeds: [WarningEmbed(`Flowing or Interactive Lyrics are already being used for this song.`, `To preserve performance, Ducky only serves one lyric request per song.\nIf a lyric message was recently deleted, wait until the next verse to try again.`)], ephemeral: true }).catch((err) => { log('Interaction Error', err) }) }

    let fetchedLyrics
    try { fetchedLyrics = await queue.songs.current.getLyricsFormatted(queue.songs.current.ids.spID) } catch (err) { }
    if (!fetchedLyrics) { return await interaction.reply({ embeds: [ErrorEmbed(`Something went wrong receiving lyrics for this track.`, `${err?.message || 'No additional error information provided.'}`)], ephemeral: true }).catch((err) => { log('Interaction Error', err) }) }

    let description = new Array()

    for (let line of fetchedLyrics) { 
        
        if (line.timeInMs !== 'CREDITS') {
            
            description.push({

                words: line.words,
                timeInMs: line.timeInMs, 
                description: `${line.words} \`${formatDur(line.timeInMs)}\``,
                active: `**${line.words} \`${formatDur(line.timeInMs)}\`**`,
                selected: `> ${line.words} \`${formatDur(line.timeInMs)}\``,
                activeSelected: `> **${line.words} \`${formatDur(line.timeInMs)}\`**`,

            })
        }
    }

    let buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.reset).setCustomId('reset').setDisabled(false)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.up).setCustomId('up').setDisabled(true)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.down).setCustomId('down').setDisabled(true)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.next).setCustomId('next').setDisabled(true))

    let message = await interaction.reply({ embeds: [CreateEmbed(queue.songs.current.titles.display.normal, `Displaying credits for this song.\nLyrics will display at the time of the first verse.\n\n${fetchedLyrics.find(entry => entry.timeInMs === 'CREDITS')?.words || 'No credits are available for this track.'}`, 'Interactive Lyrics', interaction.member, false, false, 'Lyrics Provided By Spotify') ], components: [buttons] }).catch((err) => { })
    try { queue.songs.current.startSyncedLyrics(message, 'full', fetchedLyrics, description) } catch (err) { log('Interaction Error', err) }

    if (resolvedUser.checkCTA('lyrics')) { 

        interaction.followUp({ embeds: [ resolvedUser.getCTA('lyrics') ], ephemeral: true }).catch((err) => { log("CTA Error", err) })

    }

    queue.lyrics.credits = fetchedLyrics.find(entry => entry.timeInMs === 'CREDITS')?.words

    let collector = message.createMessageComponentCollector({ time: 3600000 })
    
    let disableUp = false; let disableDown = false; let disableNext = false

    collector.on('collect', async (childInt) => {

        let id = childInt.customId
        await childInt.deferUpdate().catch((err) => { log('Button Defer Error', err) })

        if (!queue.lyrics.description) {            
            let buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.reset).setCustomId('reset').setDisabled(true)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.up).setCustomId('up').setDisabled(true)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.down).setCustomId('down').setDisabled(true)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.next).setCustomId('next').setDisabled(true))
            childInt?.editReply({ embeds: childInt.message.embeds, components: [buttons] }).catch((err) => { 
                log('Lyrics Edit Error', err); 
                queue.clearLyrics()
            })
            return
        }

        if (id === 'down') { 

            let select = queue.lyrics.description.find(entry => entry.timeInMs === queue.lyrics.selectedVerse?.timeInMs)

            let currentIndex = queue.lyrics.description.indexOf(queue.lyrics.currentLine)
            let previousSelected = queue.lyrics.description.indexOf(select)
            if (previousSelected === -1) { previousSelected = currentIndex }
            let selectedIndex = queue.lyrics.description.indexOf(queue.lyrics.description[previousSelected + 1])
            queue.lyrics.selectedVerse = { words: queue.lyrics.description[selectedIndex].words, timeInMs: queue.lyrics.description[selectedIndex].timeInMs }

            if (queue.lyrics.description[selectedIndex] === queue.lyrics.description[0]) { disableUp = true }
            if (selectedIndex + 1 === queue.lyrics.description.length - 1) { disableDown = true }
            disableNext = false

            let newDescription = getDescription(currentIndex, previousSelected + 1)

            let buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.reset).setCustomId('reset').setDisabled(false)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.up).setCustomId('up').setDisabled(disableUp)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.down).setCustomId('down').setDisabled(disableDown)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.next).setCustomId('next').setDisabled(disableNext))
            childInt?.editReply({ embeds: [CreateEmbed(queue.songs.current.titles.display.normal, newDescription.join('\n'), 'Interactive Lyrics', false, false, false, 'Lyrics Provided By Spotify')], components: [buttons] }).catch((err) => { 
                log('Lyrics Edit Error', err); 
                queue.clearLyrics()
            })

        }

        if (id === 'up') { 

            let select = queue.lyrics.description.find(entry => entry.timeInMs === queue.lyrics.selectedVerse?.timeInMs)

            let currentIndex = queue.lyrics.description.indexOf(queue.lyrics.currentLine)
            let previousSelected = queue.lyrics.description.indexOf(select || queue.lyrics.currentLine)
            if (previousSelected === -1) { previousSelected = currentIndex }
            let selectedIndex = queue.lyrics.description.indexOf(queue.lyrics.description[previousSelected - 1])
            queue.lyrics.selectedVerse = { words: queue.lyrics.description[selectedIndex].words, timeInMs: queue.lyrics.description[selectedIndex].timeInMs }
            
            if (queue.lyrics.description[selectedIndex] === queue.lyrics.description[0]) { disableUp = true }
            if (selectedIndex + 1 === queue.lyrics.description.length - 1) { disableDown = true }
            disableNext = false

            let newDescription = getDescription(currentIndex, previousSelected - 1)

            let buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.reset).setCustomId('reset').setDisabled(false)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.up).setCustomId('up').setDisabled(disableUp)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.down).setCustomId('down').setDisabled(disableDown)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.next).setCustomId('next').setDisabled(disableNext))
            childInt?.editReply({ embeds: [CreateEmbed(queue.songs.current.titles.display.normal, newDescription.join('\n'), 'Interactive Lyrics', false, false, false, 'Lyrics Provided By Spotify')], components: [buttons] }).catch((err) => { 
                log('Lyrics Edit Error', err); 
                queue.clearLyrics()
            })

        }

        if (id === 'next') { 

            let user = await getUser(childInt.user.id, process.meta.client)
            const { isActive, expiry } = await user.checkCooldown('button-lyricsff')

            if (isActive) { return childInt.followUp({ embeds: [WarningEmbed('You are being time restricted from this action.', `You can use this button again starting at <t:${expiry}:T>`)], ephemeral: true }) }

            user.addCooldown('button-lyricsff', 10)

            let timeToSkipTo = (queue.lyrics.selectedVerse?.timeInMs / 1000).toFixed()
            
            try { queue.songs.current.ffmpeg(timeToSkipTo) } catch (err) { 
                    
                log('Seek Error', err)
                childInt.followUp({ embeds:[ ErrorEmbed("This song could not be seeked.", `This may be due to the format being unsupported.\nThis error should only occur when playing from an unknown URL.`) ], components: [], ephemeral: true }).catch(() => {})

            }
        }

        if (id === 'reset') { 

            queue.lyrics.selectedVerse = null
            
            let currentIndex = queue.lyrics.description.indexOf(queue.lyrics.currentLine)
            
            let newDescription = getDescription(currentIndex, null)

            disableNext = true

            let buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.reset).setCustomId('reset').setDisabled(false)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.up).setCustomId('up').setDisabled(disableUp)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.down).setCustomId('down').setDisabled(disableDown)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.next).setCustomId('next').setDisabled(disableNext))
            childInt?.editReply({ embeds: [CreateEmbed(queue.songs.current.titles.display.normal, newDescription.join('\n'), 'Interactive Lyrics', false, false, false, 'Lyrics Provided By Spotify')], components: [buttons] }).catch((err) => { 
                log('Lyrics Edit Error', err); 
                queue.clearLyrics()
            })

        }

        
    })

    function getDescription(current, selected) { 

        let combinedDescription = new Array()
        for (const entry of queue.lyrics.description) { 

            let toPush = entry.description 
            if (queue.lyrics.description.indexOf(entry) === selected) { toPush = entry.selected }
            if (queue.lyrics.description.indexOf(entry) === current) {
                if (queue.lyrics.description.indexOf(entry) === selected) { toPush = entry.activeSelected }
                else { toPush = entry.active }
            }
            combinedDescription.push(toPush)
        }

        return combinedDescription

    }


    function formatDur(ms) {
    
        let seconds = (ms / 1000).toFixed()
        let h, m, s, result = '';
        
        h = Math.floor(seconds / 3600);
        seconds -= h * 3600;
        
        if (h) {
            result = h<10 ? '0'+h+':' : h+':';
        }
    
        m = Math.floor(seconds / 60);
        seconds -= m * 60;
        result += m < 10 ? '0' + m + ':' : m + ':';
    
        s = seconds % 60;
        result += s<10 ? '0'+s : s;
        return result;
    
    }

}

async function execute_voice(args, queue, user) { 

    if (!queue.songs?.current?.ids?.spID) { return await queue.speak('Time synced lyrics are not available for queue song.') }
    if (queue.lyrics.lyricsInProgress) { return await queue.speak('Sorry, but lyrics are already in progress.') }

    let message = await queue.textChannel.send({ embeds: [CreateEmbed(`<:instrumental:${process.meta.config.botSettings.buttons.instrumentalPlaceholder}>`, null, 'Flowing Lyrics', null, '1cfaa4', null, 'Provided By Spotify', true)] }).catch((err) => { })

    await queue.speak(`Flowing lyrics have been sent in ${queue.textChannel?.name || 'the current channel'}.`)

    try { await queue.songs.current.startSyncedLyrics(message) }
    catch (err) {
        log('Lyric Error', err)
        return await message.edit({ embeds: [ErrorEmbed('We found time-synced lyrics, but can\'t process them.', `Something prevented Ducky from processing neccessary lyric data.\nPlease [contact support](${process.meta.config.misc.links.support}) if this error continues.`)] }).catch((err) => { log('Interaction Error', err) })
    }

} 

export { command, commandData, execute, execute_voice }

