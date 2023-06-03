'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { log, limit, sentenceCase, formatDur } from '../functions/misc.js'
import { CreateEmbed, WarningEmbed } from "../functions/interface.js"
import { filledBar } from 'string-progressbar'
import { song } from '../classes/song.js'
import { DateTime } from 'luxon'

const command = new Object()
command.name = 'current'
command.description = `View stats and background information on the current song.`
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 5

async function execute(interaction, resolvedUser, discordClient) { 
    
    let queue = process.meta.queues.get(interaction.guild.id)
    if (!queue) { return interaction.reply({ embeds: [WarningEmbed("Ducky is not playing anything in this server.", `To view information on the current song, join a voice channel and play a song first.`)], components: [], ephemeral: true }).catch(() => {})  }
    if (!queue.songs.current) { return interaction.reply({ embeds: [WarningEmbed("There is no song currently playing.", `To view lyrics, a song must be playing first.`)], components: [], ephemeral: true }).catch(() => { }) }

    const progressBar = filledBar(queue.songs.current.duration.ms, queue.players.music.currentResource.playbackDuration, 35)[0]
    
    let details = new Object()
    if (!song.info) { try { details = await queue.songs.current.getGeniusDetails() } catch (err) { log('Genius Error', err); } }
    else { details = song.info } // use any cached data available (loading time cuts!)

    let covers = new Array(); let lives = new Array(); let remixes = new Array()
    let sources = new Array(); let writers = new Array(); let producers = new Array()

    details.writers?.forEach((artist) => { writers.push(`[${artist.name}](${artist.url})`) })
    details.producers?.forEach((artist) => { producers.push(`[${artist.name}](${artist.url})`) })
    details.relatedSongs.covers?.forEach((song) => { covers.push(`[${song.artist}](${song.url})`) })
    details.relatedSongs.live?.forEach((song) => { lives.push(`[${song.name}](${song.url})`)})
    details.relatedSongs.remixes?.forEach((song) => { remixes.push(`[${song.artist}](${song.url})`)})

    if (covers.length < 1) { covers.push('No covers for this song could be found.') }
    if (lives.length < 1) { lives.push('No live performances for this song could be found.')}
    if (remixes.length < 1) { remixes.push('No remixes for this song could be found.')}
    if (writers.length < 1) { writers.push('No writers for this song could be found.') }
    if (producers.length < 1) { producers.push('No producers for this song could be found.') }
    
    for (const source of details?.sources || []) { 

        if (source.name === 'youtube') { sources.push(`[YouTube](${source.url})`) }
        else if (source.name === 'spotify') { sources.push(`[Spotify](${source.url})`)}
        else if (source.name === 'soundcloud') { sources.push(`[SoundCloud](${source.url})`)}
        else { sources.push(`[${sentenceCase(source.name)}](${source.url})`)}

    }

    if (sources.length < 1) { 

        for (let [key, sourceObj] of Object.entries(queue.songs.current.sources)) { 

            if (key === 'yt') { sources.push(`[YouTube](${sourceObj?.url || queue.songs.current.urls.duckyURL})`) }
            else if (key === 'sc') { sources.push(`[SoundCloud](${sourceObj?.url || queue.songs.current.urls.duckyURL})`)}
            else if (key === 'sp') { sources.push(`[Spotify](${sourceObj?.url || queue.songs.current.urls.duckyURL})`)}

        }

    }

    if (sources.length < 1) { sources.push('No sources for this song could be found.')}

    let released;

    if (queue.songs.current.sources?.sp?.album?.release_date || queue.songs.current.sources?.yt?.uploadedAt?.includes('-')) {

        let parsed = DateTime.fromISO(queue.songs.current.sources?.sp?.album?.release_date || queue.songs.current.sources?.yt?.uploadedAt)
        released = parsed.toLocaleString(DateTime.DATE_MED)

    }
    
    const embed = CreateEmbed(queue.songs.current.titles.display.normal,
        limit(details.description, 650, `... [see more.](${details.geniusURL})\nㅤ`) || 'No song description found.',
        `Currently Playing`, interaction.member, null,
        [

            { name: 'Part Of', value: `[${details.album.title || 'Single'}](${details.album.geniusURL || queue.songs.current.urls.duckyURL})`, inline: true },
            { name: 'Main Artist', value: `[${details.artist.name || queue.songs.current.artists[0] || 'Unknown'}](${details.artist.image || queue.songs.current.coverArt })`, inline: true },
            { name: 'Released On', value: `[${details.released || released || 'Unknown'}](${details.album.geniusURL || queue.songs.current.urls.duckyURL})`, inline: true },
            { name: 'Available On', value: `${sources.join('\n')}`, inline: true },
            { name: 'Producers', value: `${producers.join('\n')}`, inline: true },
            { name: 'Writers', value: `${writers.join('\n')}`, inline: true },
            { name: '3rd Party Covers', value: `${covers.join('\n')}`, inline: true },
            { name: 'Artist Remixes', value: `${remixes.join('\n')}`, inline: true },
            { name: 'Live Performances', value: `${lives.join('\n')}`, inline: true },
            { name: 'ㅤ', value: `${queue.songs.current.timeLeft()} ${progressBar} ${formatDur(queue.songs.current.duration.sec)}\nㅤ`, inline: false },
        ],
        'Provided by Genius',
        false, { thumbnail: details.albumArt, url: details.geniusURL || queue.songs.current.urls.duckyURL }
    )
    
    let buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.last).setCustomId('last')).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.lyrics).setCustomId('lyrics')).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.queue).setCustomId('queue')).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.save).setCustomId('save')).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.next).setCustomId('next'))
    await interaction.reply({ embeds: [embed], components: [buttons] }).then((msg) => { queue.handleStdButtonIds(msg, queue.songs.current)}).catch((err) => { interaction.editReply({ embeds: [embed], components: [buttons] }).then((msg) => { queue.handleStdButtonIds(msg, queue.songs.current)}).catch((err) => { log('2nd Interaction Error', err); throw new Error('Received multiple commandInteraction reply errors.') }) })

}

export { command, commandData, execute }