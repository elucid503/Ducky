'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ActionRowBuilder, ButtonBuilder, ButtonStyle, SelectMenuBuilder } from 'discord.js'
import { CreateEmbed, WarningEmbed, ErrorEmbed } from "../functions/interface.js"
import { log, checkJoinability, sentenceCase } from '../functions/misc.js'
import { getQueue } from '../classes/queue.js'
import { limit } from '../functions/misc.js'
import { song } from '../classes/song.js'
import { DateTime } from 'luxon'

const command = new Object()
command.name = 'history'
command.description = `View all your previously played songs.`
command.options = [ ]
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 0

async function execute(interaction, resolvedUser, discordClient) {

    Array.prototype.insert = function (index, item) { this.splice(index, 0, item) }

    const history = resolvedUser.history 
    let selected = null
    let min = 0; let max = 10

    if (history.length < 1) { 
        return interaction.reply({ embeds: [WarningEmbed('You have no songs in your history, yet.', 'Play songs and see them appear here!')], ephemeral: true }).catch((err => log("Interaction Error", err)))
    }

    function getComponents(min = 0, max = 10, selected = null) { 

        let options = new Array()

        for (let step = min; step < max; step++) { 
            
            if (history[step]) options.push({ label: limit(history[step]?.titles?.display?.normal, 95), description: limit(`by ${history[step].artists[0]}; on ${history[step]?.album || history[step]?.titles?.display?.normal}`, 95), value: step.toString() })

        }

        let disableB, disableF, disableA = true 

        if (history[min - 1]) { disableB = false }
        if (history[max + 1]) { disableF = false }
        if (typeof selected === 'number') { disableA = false }

        const actionRow_1 = new ActionRowBuilder().addComponents(new SelectMenuBuilder().setOptions(options).setCustomId('select').setPlaceholder('Select a song from above.'))
        const actionRow_2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('back').setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.lastPage).setDisabled(disableB)).addComponents(new ButtonBuilder().setCustomId('info').setDisabled(disableA).setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.info)).addComponents(new ButtonBuilder().setCustomId('play').setDisabled(disableA).setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.main.play)).addComponents(new ButtonBuilder().setCustomId('remove').setDisabled(disableA).setStyle(ButtonStyle.Secondary).setEmoji('1024086708490346597')).addComponents(new ButtonBuilder().setCustomId('next').setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.nextPage).setDisabled(disableF))

        return [ actionRow_1, actionRow_2 ]

    }

    function getDescription(min = 0, max = 10, selected = null) { 

        let lines = new Array()

        for (let step = min; step < max; step++) { 
            
            let prefix = ''
            if (step == selected) { prefix = '>' }

            if (history[step]) lines.push(`${prefix} [${history[step]?.titles.display.normal}](${history[step]?.urls.duckyURL}) • ${history[step]?.artists[0]}${history[step]?.releasedYear ? `, ${history[step]?.releasedYear}` : ''}${history[step]?.timestamp ? `\nPlayed on ${DateTime.fromMillis(history[step].timestamp).toLocaleString(DateTime.DATE_SHORT)}` : ''}`)

        }

        return lines.join('\n\n')

    }

    interaction.reply({ embeds: [CreateEmbed(`${interaction.member.user.username}'s History`, getDescription(min, max, selected), 'Song History', interaction.member, null, null, null, null, { thumbnail: interaction.member.user.avatarURL() })], components: getComponents(min, max, selected), ephemeral: true }).then((msg) => { handleButtons(msg) }).catch((err) => { log("Interaction Error", err)})

    function handleButtons(msg) { 
        
    let collector = msg.createMessageComponentCollector({ time: 3600000 })

        collector.on('collect', async (childInt) => {

            let id = childInt.customId
            await childInt.deferUpdate().catch((err) => { log('Button Defer Error', err) })

            if (id === 'select') {

                selected = parseInt(childInt.values[0])

                childInt.message.edit({ embeds: [CreateEmbed(`${interaction.member.user.username}'s History`, getDescription(min, max, selected), 'Song History', interaction.member, null, null, null, null, { thumbnail: history[selected]?.coverArt })], components: getComponents(min, max, selected)}).catch((err) => { log("Interaction Error", err)})

            }

            if (id === 'info') { 

                let selectedSong = history[selected]
                let resolvedSong = new song(selectedSong)
                
                let details = new Object()
                if (!song.info) { try { details = await resolvedSong.getGeniusDetails() } catch (err) { log('Genius Error', err); } }
                else { details = song.info } // use any cached data available (loading time cuts!)
            
                let covers = new Array(); let lives = new Array(); let remixes = new Array()
                let sources = new Array(); let writers = new Array(); let producers = new Array()
            
                details.writers?.forEach((artist) => { writers.push(`[${artist.name}](${artist.url})`) })
                details.producers?.forEach((artist) => { producers.push(`[${artist.name}](${artist.url})`) })
                details.relatedSongs.covers?.forEach((song) => { covers.push(`[${song.artist}](${song.url})`) })
                details.relatedSongs.live?.forEach((song) => { lives.push(`[${song.name}](${song.url})`) })
                details.relatedSongs.remixes?.forEach((song) => { remixes.push(`[${song.artist}](${song.url})`) })
            
                if (covers.length < 1) { covers.push('No covers for this song could be found.') }
                if (lives.length < 1) { lives.push('No live performances for this song could be found.') }
                if (remixes.length < 1) { remixes.push('No remixes for this song could be found.') }
                if (writers.length < 1) { writers.push('No writers for this song could be found.') }
                if (producers.length < 1) { producers.push('No producers for this song could be found.') }
                
                for (const source of details?.sources || []) {
            
                    if (source.name === 'youtube') { sources.push(`[YouTube](${source.url})`) }
                    else if (source.name === 'spotify') { sources.push(`[Spotify](${source.url})`) }
                    else if (source.name === 'soundcloud') { sources.push(`[SoundCloud](${source.url})`) }
                    else { sources.push(`[${sentenceCase(source.name)}](${source.url})`) }
            
                }
            
                if (sources.length < 1) {
            
                    for (let [key, sourceObj] of Object.entries(resolvedSong.sources)) {
            
                        if (key === 'yt') { sources.push(`[YouTube](${sourceObj?.url || resolvedSong.urls.duckyURL})`) }
                        else if (key === 'sc') { sources.push(`[SoundCloud](${sourceObj?.url || resolvedSong.urls.duckyURL})`) }
                        else if (key === 'sp') { sources.push(`[Spotify](${sourceObj?.url || resolvedSong.urls.duckyURL})`) }
            
                    }
            
                }
            
                if (sources.length < 1) { sources.push('No sources for this song could be found.') }
            
                let released;
            
                if (resolvedSong.sources?.sp?.album?.release_date || resolvedSong.sources?.yt?.uploadedAt?.includes('-')) {
            
                    let parsed = DateTime.fromISO(resolvedSong.sources?.sp?.album?.release_date || resolvedSong.sources?.yt?.uploadedAt)
                    released = parsed.toLocaleString(DateTime.DATE_MED)
            
                }
                
                const embed = CreateEmbed(resolvedSong.titles.display.normal,
                    limit(details.description, 650, `... [see more.](${details.geniusURL})\nㅤ`) || 'No song description found.',
                    `Extended Info`, interaction.member, null,
                    [
            
                        { name: 'Part Of', value: `[${details.album.title || 'Single'}](${details.album.geniusURL || resolvedSong.urls.duckyURL})`, inline: true },
                        { name: 'Main Artist', value: `[${details.artist.name || queue.songs.current.artists[0] || 'Unknown'}](${details.artist.image || resolvedSong.coverArt})`, inline: true },
                        { name: 'Released On', value: `[${details.released || released || 'Unknown'}](${details.album.geniusURL || resolvedSong.urls.duckyURL})`, inline: true },
                        { name: 'Available On', value: `${sources.join('\n')}`, inline: true },
                        { name: 'Producers', value: `${producers.join('\n')}`, inline: true },
                        { name: 'Writers', value: `${writers.join('\n')}`, inline: true },
                        { name: '3rd Party Covers', value: `${covers.join('\n')}`, inline: true },
                        { name: 'Artist Remixes', value: `${remixes.join('\n')}`, inline: true },
                        { name: 'Live Performances', value: `${lives.join('\n')}`, inline: true },
                    ],
                    'Provided by Genius',
                    false, { thumbnail: details.albumArt, url: details.geniusURL || resolvedSong.urls.duckyURL }
                )
            
                childInt.followUp({ embeds: [embed], ephemeral: true }).catch((err) => { })

            }

            if (id === 'play') { 

                let queue = process.meta.queues.get(interaction.guild.id)
                if (!queue) {
                
                    try { await checkJoinability(interaction.member, interaction.guild, 0) } catch (error) {

                        let joinableError = String(error.message)
                        return childInt.followUp({ embeds: [WarningEmbed("You can't play this song right now.", joinableError)], ephemeral: true })
                
                    }
                
                    try {
                        queue = await getQueue(interaction.guild.id, interaction.member.voice.channel, interaction.channel, discordClient)
                    } catch (err) {
                        log('Queue Creation Error', err)
                        childInt.followUp({ embeds: [ErrorEmbed("This server's queue is not fetchable.", `Something prevented Ducky from getting a queue for this server.\nPlease [contact support](${process.meta.support}) if this continues.`)], components: [], ephemeral: true })
                        return
                    }
                
                    if (!interaction.guild.members?.me?.voice?.channel?.id) {
                        try { queue.connect() } catch (err) {
                            log('Connection Error', err)
                            childInt.followUp({ embeds: [ErrorEmbed("Ducky could not connect to your call.", `Something prevented Ducky from connecting to your call.\nPlease [contact support](${process.meta.support}) if this continues.`)], components: [], ephemeral: true })
                            return
                        }
                    }
                }

                let resolvedSong = new song(history[selected], interaction.member, interaction.channel)

                let posResp = queue.add(resolvedSong)
                queue.update()

                let channel = queue.textChannel || interaction.channel
                channel.send({ embeds: [resolvedSong.getEmbed(true)], components: queue.getPlayButtons(resolvedSong) }).then((msg) => { if (msg) queue.handleStdButtonIds(msg, resolvedSong) }).catch((err) => { })

                if (posResp === 0) {
                    try { await queue.play(0) } catch (err) {
                        log('Play / Resource Error', err)
                        childInt.followUp({ embeds: [ErrorEmbed("Ducky could not play this song.", err.message)], components: [], ephemeral: true }).catch(() => { })
                        queue.remove(resolvedSong)
                        return
                    }
                }
            }

            if (id === 'remove') { 

                resolvedUser.history.splice(selected, 1)
                resolvedUser.save()

                childInt.message.edit({ embeds: [CreateEmbed(`${interaction.member.user.username}'s History`, getDescription(min, max, selected), 'Song History', interaction.member)], components: getComponents(min, max, selected)}).catch((err) => { log("Interaction Error", err)})

            }

            if (id === 'next') { 

                min = min + 10
                max = min + 10
                selected = null 

                childInt.message.edit({ embeds: [CreateEmbed(`${interaction.member.user.username}'s History`, getDescription(min, max, selected), 'Song History', interaction.member)], components: getComponents(min, max, selected)}).catch((err) => { log("Interaction Error", err)})
                
            }

            if (id === 'last') { 

                max = min
                min = min - 10
                selected = null 

                childInt.message.edit({ embeds: [CreateEmbed(`${interaction.member.user.username}'s History`, getDescription(min, max, selected), 'Song History', interaction.member)], components: getComponents(min, max, selected)}).catch((err) => { log("Interaction Error", err)})
            }

        })
    
    }

}

export { command, commandData, execute }