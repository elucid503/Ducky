'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputStyle, TextInputBuilder } from 'discord.js'
import { CreateEmbed, WarningEmbed, ErrorEmbed } from "../functions/interface.js"
import { log, checkJoinability, wordChoice } from '../functions/misc.js'
import { sentenceCase, limit } from '../functions/misc.js'
import { song, writeableSong } from '../classes/song.js'
import { convertSpToYt } from '../functions/sources.js'
import { playlist } from '../classes/playlist.js'
import { getQueue } from '../classes/queue.js'
import { getUser } from '../classes/user.js'
import { DateTime } from 'luxon'

const command = new Object()
command.name = 'library'
command.voiceName = 'save'
command.description = `View highlighted and liked songs, saved queues and playlists and your Spotify albums if linked.`
command.options = [ { name: "page", description: 'Choose which library page to view.', choices: [ { name: 'Liked Songs', value: 'songs' }, { name: 'Saved Playlists', value: 'playlists' }, ], type: ApplicationCommandOptionType.String, required: true }  ]
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 0

async function execute(interaction, resolvedUser, discordClient) {

    Array.prototype.insert = function (index, item) { this.splice(index, 0, item) }

    let parRegex = / *\([^)]*\) */g; let barRegex = / *\[[^)]*\] */g

    Array.prototype.sortBy = function (p) { return this.slice(0).sort(function (a, b) { return (a[p] < b[p]) ? 1 : (a[p] > b[p]) ? -1 : 0; }); }
    // sorts greatest to least

    const page = interaction.options.get('page').value
    let selected = null; let maxValue = 5; let minValue = 0

    const user = await getUser(interaction.member.user.id, process.meta.client)
    if (!user) { return interaction.reply({ embeds: [WarningEmbed(`We couldn't find any data for you!`, `For some reason, there is no user file linked to your ID.\nPlease [contact support](${process.meta.config.misc.links.support}) if this error continues.`)], ephemeral: true }) }
    
    function getDisplay(maxValue = 5, minValue = 0, selected = null) {

        const songs = (user.library?.songs || new Array())
        const playlists = (user.library?.playlists || new Array())
            
        const descriptions = { songsPage: new Array(), playlistsPage: new Array(), spotifyPage: new Array() }

        for (let i = minValue; i < maxValue; i += 1) {

            let prefix = ''
            if (i === selected - 1) { prefix = '> ' }
            if (songs[i]) {
                descriptions.songsPage.push(`${prefix} [${songs[i]?.titles.display.normal?.replace(barRegex, '')?.replace(parRegex, '')}](${songs[i]?.urls.duckyURL}) • ${songs[i]?.artists[0]}${songs[i]?.releasedYear ? `, ${songs[i]?.releasedYear}` : ''}\n`)

            }
            if (playlists[i]) {
                descriptions.playlistsPage.push(`${prefix} [${playlists[i].name}](${playlists[i].url}) • Created by ${playlists[i].creator || "unknown"}, ${playlists[i].songs?.length} ${wordChoice(playlists[i].songs?.length, 'song')}\n${limit(playlists[i].description, 45) || 'No description provided.'}\n`)
            }
       
        }

        descriptions.songsPage.push(`...${songs.length - maxValue < 0 ? 0 : songs.length - maxValue} ${wordChoice(songs.length - maxValue < 0 ? 0 : songs.length - maxValue, 'song')} left`)
        descriptions.playlistsPage.push(`...${playlist.length - maxValue < 0 ? 0 : playlist.length - maxValue} ${wordChoice(playlist.length - maxValue < 0 ? 0 : playlist.length - maxValue, 'playlist')} left`)
        return descriptions

    }

    function getButtons(max, customVals = { selected: null, playlistSongs: null }) {

        let customSelected = selected
        if (customVals.playlistSongs) { customSelected = customVals.selected }
        if (!customSelected) { customSelected = 0; }

        let resetDisabled = true; let downDisabled = true; let upDisabled = true; let addDisabled = true; let rmDisabled = true; let infoDisabled = true
        let pageBackDisabled = true; let nextPageDisabled = true

        if (page === 'songs') {

            if (user.library?.songs[max]) { nextPageDisabled = false }
            if (user.library?.songs[max - 6]) { pageBackDisabled = false }

        }
        
        else if (page === 'playlists' && !customVals.playlistSongs) {

            if (user.library?.playlists[max + 1]) { nextPageDisabled = false }
            if (user.library?.playlists[max - 6]) { pageBackDisabled = false }
    
        }

        if (customVals.playlistSongs) { 

            if (customVals.playlistSongs[max + 1]) { nextPageDisabled = false }
            if (customVals.playlistSongs[max - 6]) { pageBackDisabled = false }

        }

        if (customSelected > 0) {

            resetDisabled = false; addDisabled = false; rmDisabled = false; infoDisabled = false

        }
    
        if (page === 'songs') { if (customSelected < user.library?.songs?.length) { downDisabled = false } }
        else if (page === 'playlists' && !customVals.playlistSongs) { if (customSelected < user.library?.playlists?.length) { downDisabled = false } }
        if (customVals.playlistSongs) { if (customSelected < customVals.playlistSongs?.length) { downDisabled = false } }
        if (customVals.playlistSongs) { if (customSelected < customVals.playlistSongs?.length) { downDisabled = false } }
        if (customSelected > 0) { upDisabled = false }

        if (customVals.playlistSongs) { resetDisabled = false }
        
        let row1 = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.reset).setCustomId('reset').setDisabled(resetDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.up).setCustomId('up').setDisabled(upDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.down).setCustomId('down').setDisabled(downDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.addToQueue).setCustomId('add').setDisabled(addDisabled))
        let row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji('1042216548028395590').setCustomId('last-page').setDisabled(pageBackDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.remove).setCustomId('remove').setDisabled(rmDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.info).setCustomId('info').setDisabled(infoDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.nextPage).setCustomId('next-page').setDisabled(nextPageDisabled))
        
        if (user.connections.spotify.refresh_token) { 
            row1.addComponents().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.sync).setCustomId('sync'))
            row2.addComponents().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.report).setCustomId('report'))
        }
        
        return [row1, row2]
        
    }

    let returnedDescriptions = getDisplay(maxValue, minValue, selected)
    let embed = CreateEmbed(page === 'songs' ? 'Your Liked Songs' : 'Your Saved Playlists', page === 'songs' ? returnedDescriptions.songsPage.join('\n') : returnedDescriptions.playlistsPage.join('\n'), `${interaction.member.user.username}'s Library`, interaction.member, null, null, null, null, { thumbnail: interaction.member.user.avatarURL() })

    interaction.reply({ embeds: [embed], components: getButtons(maxValue), ephemeral: true }).then((msg) => {
       
        handleButtons(msg)
       
        if (user.checkCTA('library')) { 

            interaction.followUp({ embeds: [ user.getCTA('library') ], ephemeral: true }).catch((err) => { log("CTA Error", err) })
    
        }

    }).catch((err) => { log('Interaction Reply Error', err) })

    function handleButtons(msg) {

        let collector = msg.createMessageComponentCollector({ time: 3600000 })

        collector.on('collect', async (childInt) => {

            let id = childInt.customId
            if (id !== 'report') { await childInt.deferUpdate().catch((err) => { log('Button Defer Error', err) }) } 

            if (id === 'sync') {

                const { isActive, expiry } = await user.checkCooldown('button-sync')
    
                if (isActive) { return childInt.followUp({ embeds: [WarningEmbed('You are being time restricted from this action.', `You can use this button again starting at <t:${expiry}:T>`)], ephemeral: true }) }
    
                user.addCooldown('button-sync', 30)
    
                try { await user.refreshSpotifySongs() } catch (err) {
                    log("Spotify Refresh Error", err)
                    return childInt.followUp({ embeds: [ErrorEmbed("We could not sync your Spotify account media.", 'Please try running `/sync` again and reconnect your account.')], ephemeral: true })
                }

                maxValue = 5; minValue = 0; selected = null

                let returnedDescriptions = getDisplay(maxValue, minValue, selected)
                let embed = CreateEmbed(page === 'songs' ? 'Your Liked Songs' : 'Your Saved Playlists', page === 'songs' ? returnedDescriptions.songsPage.join('\n') : returnedDescriptions.playlistsPage.join('\n'), `${interaction.member.user.username}'s Library`, interaction.member, null, null, null, null, { thumbnail: interaction.member.user.avatarURL() })
            
                interaction.editReply({ embeds: [embed], components: getButtons(maxValue), ephemeral: true }).then((msg) => { }).catch((err) => { log('Interaction Reply Error', err) })

            }

            if (id === 'report') {
                
                const modal = new ModalBuilder().setCustomId('namePlaylist').setTitle("Tell Us What's Wrong")
        
                const nameInput = new TextInputBuilder().setCustomId('area').setLabel("Give a summary of the error").setStyle(TextInputStyle.Short).setRequired(true)
                const descriptionInput = new TextInputBuilder().setCustomId('description').setLabel("Enter an optional description for this error").setStyle(TextInputStyle.Short).setRequired(false);

                const actionRow = new ActionRowBuilder().addComponents(nameInput)
                const nextRow = new ActionRowBuilder().addComponents(descriptionInput)
                modal.addComponents(actionRow, nextRow)

                childInt.showModal(modal)

                childInt.awaitModalSubmit({ time: 300000 })
                    
                    .then(async (modalInt) => {

                        modalInt.deferUpdate().catch((err) => { })

                        const area = modalInt.fields.getTextInputValue('area')
                        const description = modalInt.fields.getTextInputValue('description')

                        log("Error Reported", `Summary: ${area}\n\nDescription: ${description}`)
                        childInt.followUp({ embeds: [ CreateEmbed("Thank you for the feedback!", 'Your feedback helps make Ducky better.\nWe will consider your submission and work on whatever has gone wrong!\nThank you for your patience and understanding.', 'Feedback Submission', childInt.member)], ephemeral: true }).catch((err) => { log("Interaction Error", err )})
                    
                    })
            }

            if (id === 'reset') {

                maxValue = 5; minValue = 0; selected = null

                let returnedDescriptions = getDisplay(maxValue, minValue, selected)
                let embed = CreateEmbed(page === 'songs' ? 'Your Liked Songs' : 'Your Saved Playlists', page === 'songs' ? returnedDescriptions.songsPage.join('\n') : returnedDescriptions.playlistsPage.join('\n'), `${interaction.member.user.username}'s Library`, interaction.member, null, null, null, null, { thumbnail: interaction.member.user.avatarURL() })
            
                interaction.editReply({ embeds: [embed], components: getButtons(maxValue), ephemeral: true }).then((msg) => { }).catch((err) => { log('Interaction Reply Error', err) })

            }

            if (id === 'reset') {

                maxValue = 5; minValue = 0; selected = null

                let returnedDescriptions = getDisplay(maxValue, minValue, selected)
                let embed = CreateEmbed(page === 'songs' ? 'Your Liked Songs' : 'Your Saved Playlists', page === 'songs' ? returnedDescriptions.songsPage.join('\n') : returnedDescriptions.playlistsPage.join('\n'), `${interaction.member.user.username}'s Library`, interaction.member, null, null, null, null, { thumbnail: interaction.member.user.avatarURL() })
            
                interaction.editReply({ embeds: [embed], components: getButtons(maxValue), ephemeral: true }).then((msg) => { }).catch((err) => { log('Interaction Reply Error', err) })

            }
            
            else if (id === 'down') {
                
                selected = selected + 1
                if (selected > maxValue) { maxValue = maxValue + 5; minValue = maxValue - 5 }
                
                let returnedDescriptions = getDisplay(maxValue, minValue, selected)
                let embed = CreateEmbed(page === 'songs' ? 'Your Liked Songs' : 'Your Saved Playlists', page === 'songs' ? returnedDescriptions.songsPage.join('\n') : returnedDescriptions.playlistsPage.join('\n'), `${interaction.member.user.username}'s Library`, interaction.member, null, null, null, null, { thumbnail: page === 'songs' ? user.library.songs[selected - 1]?.coverArt || interaction.member.user.avatarURL() : interaction.member.user.avatarURL() })
            
                interaction.editReply({ embeds: [embed], components: getButtons(maxValue), ephemeral: true }).then((msg) => { }).catch((err) => { log('Interaction Reply Error', err) })

            }

            else if (id === 'up') {
                
                selected = selected - 1
                if (selected <= minValue) { minValue = minValue - 5; maxValue = minValue + 5 }
                
                let returnedDescriptions = getDisplay(maxValue, minValue, selected)
                let embed = CreateEmbed(page === 'songs' ? 'Your Liked Songs' : 'Your Saved Playlists', page === 'songs' ? returnedDescriptions.songsPage.join('\n') : returnedDescriptions.playlistsPage.join('\n'), `${interaction.member.user.username}'s Library`, interaction.member, null, null, null, null, { thumbnail: page === 'songs' ? user.library.songs[selected - 1]?.coverArt || interaction.member.user.avatarURL() : interaction.member.user.avatarURL() })
            
                interaction.editReply({ embeds: [embed], components: getButtons(maxValue), ephemeral: true }).then((msg) => { }).catch((err) => { log('Interaction Reply Error', err) })

            }

            else if (id === 'last-page') {
                
                minValue = minValue - 5; maxValue = minValue + 5
                selected = maxValue
                
                let returnedDescriptions = getDisplay(maxValue, minValue, selected)
                let embed = CreateEmbed(page === 'songs' ? 'Your Liked Songs' : 'Your Saved Playlists', page === 'songs' ? returnedDescriptions.songsPage.join('\n') : returnedDescriptions.playlistsPage.join('\n'), `${interaction.member.user.username}'s Library`, interaction.member, null, null, null, null, { thumbnail: page === 'songs' ? user.library.songs[selected - 1]?.coverArt || interaction.member.user.avatarURL() : interaction.member.user.avatarURL() })
            
                interaction.editReply({ embeds: [embed], components: getButtons(maxValue), ephemeral: true }).then((msg) => { }).catch((err) => { log('Interaction Reply Error', err) })

            }

            else if (id === 'next-page') {

                maxValue = maxValue + 5; minValue = maxValue - 5
                selected = minValue
                
                let returnedDescriptions = getDisplay(maxValue, minValue, selected)
                let embed = CreateEmbed(page === 'songs' ? 'Your Liked Songs' : 'Your Saved Playlists', page === 'songs' ? returnedDescriptions.songsPage.join('\n') : returnedDescriptions.playlistsPage.join('\n'), `${interaction.member.user.username}'s Library`, interaction.member, null, null, null, null, { thumbnail: page === 'songs' ? user.library.songs[selected - 1]?.coverArt || interaction.member.user.avatarURL() : interaction.member.user.avatarURL() })
                interaction.editReply({ embeds: [embed], components: getButtons(maxValue), ephemeral: true }).then((msg) => { }).catch((err) => { log('Interaction Reply Error', err) })

            }

            else if (id === 'add') {

                let queue = process.meta.queues.get(interaction.guild.id)
                if (!queue) {
                
                    try { await checkJoinability(interaction.member, interaction.guild, 0) } catch (error) {

                        let joinableError = String(error.message)
                        return childInt.followUp({ embeds: [WarningEmbed("You can't use this button right now.", joinableError)], ephemeral: true })
                
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
                    
                if (page === 'songs') {

                    let selectedSong = user.library?.songs[selected - 1]
                    let resolvedSong

                    if (!selected?.urls?.ytURL) {
                        let bestYt = await convertSpToYt(selectedSong.sources.sp)
                        if (!bestYt) {
                            return childInt.followUp({ embeds: [ ErrorEmbed('This song could not be played.', 'This song\'s media is currently unaccessable to Ducky.' )], ephemeral: true }).catch((err) => { })
                        }
                        resolvedSong = new song(null, interaction.member, interaction.channel, null, null, bestYt, selectedSong.sources.sp)
                    }
                    else {
                        resolvedSong = new song(selectedSong, interaction.member, interaction.channel) // give as much data as possible
                    }

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

                else {

                    let selectedPlaylist = user.library?.playlists[selected - 1]

                    let resolvedPlaylist = new playlist(selectedPlaylist)
                    resolvedPlaylist.addUnresolved(selectedPlaylist.songs, interaction.channel, interaction.member)

                    if (resolvedPlaylist.songs.length < 1) {
                        return childInt.followUp({ embeds: [ErrorEmbed('This playlist could not be played.', `One or more songs were not able to be resolved.\nPlease [contact support](${process.meta.support}) if this continues.`)], ephemeral: true }).catch((err) => { })
                    }

                    let firstSongToDisplay = resolvedPlaylist.songs[0]

                    if (!firstSongToDisplay?.urls?.ytURL) { 
                        let bestYt = await convertSpToYt(firstSongToDisplay.sources.sp)
                        if (!bestYt) {
                            return childInt.followUp({ embeds: [ ErrorEmbed('This song could not be played.', 'This song\'s media is currently unaccessable to Ducky.' )], ephemeral: true }).catch((err) => { })
                        }
                        firstSongToDisplay = new song(null, interaction.member, interaction.channel, null, { url: resolvedPlaylist.url, part: true, name: resolvedPlaylist.name, len: resolvedPlaylist.songs.length - 1 || 0 }, bestYt, firstSongToDisplay.sources.sp)
                    }
                    
                    let posResp = queue.add(firstSongToDisplay)
                    queue.update()

                    let channel = queue.textChannel || interaction.channel
                    channel.send({ embeds: [firstSongToDisplay.getEmbed(true)], components: queue.getPlayButtons(firstSongToDisplay) }).then((msg) => { if (msg) queue.handleStdButtonIds(msg, firstSongToDisplay) }).catch((err) => { })

                    if (posResp === 0) {
                        try { await queue.play(0) } catch (err) {
                            log('Play / Resource Error', err)
                            childInt.followUp({ embeds: [ErrorEmbed("Ducky could not play this song.", err.message)], components: [], ephemeral: true }).catch(() => { })
                            queue.remove(firstSongToDisplay)
                            return
                        }
                    }

                    for (let otherSong of resolvedPlaylist.songs) {

                        if (resolvedPlaylist.songs.indexOf(otherSong) === 0) {
                             // do not break
                        }

                        else {
                            if (!otherSong?.urls?.ytURL) {
                                let bestYt = await convertSpToYt(otherSong.sources.sp)
                                if (!bestYt) {
                                    return 
                                }
                                otherSong = new song(null, interaction.member, interaction.channel, null, null, bestYt, otherSong.sources.sp)
                                queue.add(otherSong)
                            }
                            else {
                                queue.add(otherSong)
                            }
                        }

                    }

                }

            }

            else if (id === 'remove') {

                if (page === 'songs') {

                    let selectedSong = user.library?.songs[selected - 1]
                    user.library?.songs.splice(user.library?.songs?.indexOf(selectedSong), 1)
                    
                    let returnedDescriptions = getDisplay(maxValue, minValue, selected)
                    let embed = CreateEmbed(page === 'songs' ? 'Your Liked Songs' : 'Your Saved Playlists', page === 'songs' ? returnedDescriptions.songsPage.join('\n') : returnedDescriptions.playlistsPage.join('\n'), `${interaction.member.user.username}'s Library`, interaction.member, null, null, null, null, { thumbnail: page === 'songs' ? user.library.songs[selected - 1]?.coverArt || interaction.member.user.avatarURL() : interaction.member.user.avatarURL() })
                
                    interaction.editReply({ embeds: [embed], components: getButtons(maxValue), ephemeral: true }).then((msg) => { }).catch((err) => { log('Interaction Reply Error', err) })
    
                }

                else {

                    let selectedPlaylist = user.library?.playlists[selected - 1]
                    user.library?.playlists.splice(user.library?.playlists?.indexOf(selectedPlaylist), 1)
                    
                    let returnedDescriptions = getDisplay(maxValue, minValue, selected)
                    let embed = CreateEmbed(page === 'songs' ? 'Your Liked Songs' : 'Your Saved Playlists', page === 'songs' ? returnedDescriptions.songsPage.join('\n') : returnedDescriptions.playlistsPage.join('\n'), `${interaction.member.user.username}'s Library`, interaction.member, null, null, null, null, { thumbnail: page === 'songs' ? user.library.songs[selected - 1]?.coverArt || interaction.member.user.avatarURL() : interaction.member.user.avatarURL() })
                
                    interaction.editReply({ embeds: [embed], components: getButtons(maxValue), ephemeral: true }).then((msg) => { }).catch((err) => { log('Interaction Reply Error', err) })

                }

            }

            else if (id === 'info') {

                if (page === 'playlists') {

                    let selectedPlaylist = user.library?.playlists[selected - 1]

                    return enterPlaylistMode(selectedPlaylist)

                }

                let selectedSong = user.library?.songs[selected - 1]
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

        })
    }

    function enterPlaylistMode(playlist) { 

        let playlistSelected = null; let playlistMax = 5; let playlistMin = 0

        function getPlaylistDescription() {

            let playlistDescription = new Array()

            for (let i = playlistMin; i < playlistMax; i += 1) {
    
                let prefix = ''
                if (i === playlistSelected - 1) { prefix = '> ' }
                if (playlist.songs[i]) {
                    playlistDescription.push(`${prefix} [${playlist.songs[i]?.titles.display.normal}](${playlist.songs[i]?.urls.duckyURL}) • ${playlist.songs[i]?.artists[0]}${playlist.songs[i]?.releasedYear ? `, ${playlist.songs[i]?.releasedYear}` : ''}\n`)
                }
    
            }

            return playlistDescription.join('\n')

        }

        let embed = CreateEmbed(`${playlist.name}`, `${playlist.description || 'No playlist description provided.'}\n\n${getPlaylistDescription()}`, `Viewing Playlist`, interaction.member, null, null, null, null, { thumbnail: interaction.member.user.avatarURL() })

        interaction.followUp({ embeds: [embed], components: getButtons(playlistMax, { selected: playlistSelected, playlistSongs: playlist.songs }), ephemeral: true }).then((msg) => {
            
            let collector = msg.createMessageComponentCollector({ time: 3600000 })

            collector.on('collect', async (childInt) => {
    
                let id = childInt.customId
    
                if (id === 'reset') {

                    await childInt.deferUpdate().catch((err) => { log('Button Defer Error', err) })

                    childInt.deleteReply().catch((err) => { })
                    
                }
                
                else if (id === 'down') {
                    
                    playlistSelected = playlistSelected + 1
                    if (playlistSelected > playlistMax) { playlistMax = playlistMax + 5; playlistMin = playlistMax - 5 }
                    
                    let embed = CreateEmbed(`${playlist.name}`, `${playlist.description || 'No playlist description provided.'}\n\n${getPlaylistDescription()}`, `Viewing Playlist`, interaction.member, null, null, null, null, { thumbnail: playlist.songs[playlistSelected - 1]?.coverArt || interaction.member.user.avatarURL()  })
                
                    childInt.update({ embeds: [embed], components: getButtons(playlistMax, { selected: playlistSelected, playlistSongs: playlist.songs }), ephemeral: true }).then((msg) => { }).catch((err) => { log('Interaction Reply Error', err) })
    
                }
    
                else if (id === 'up') {
                    
                    playlistSelected = playlistSelected - 1
                    if (playlistSelected <= playlistMin) { playlistMin = playlistMin - 5; playlistMax = playlistMin + 5 }
                    
                    let embed = CreateEmbed(`${playlist.name}`, `${playlist.description || 'No playlist description provided.'}\n\n${getPlaylistDescription()}`, `Viewing Playlist`, interaction.member, null, null, null, null, { thumbnail: playlist.songs[playlistSelected - 1]?.coverArt || interaction.member.user.avatarURL() })
                
                    childInt.update({ embeds: [embed], components: getButtons(playlistMax, { selected: playlistSelected, playlistSongs: playlist.songs }), ephemeral: true }).then((msg) => { }).catch((err) => { log('Interaction Reply Error', err) })
    
                }
    
                else if (id === 'last-page') {
                    
                    playlistMin = playlistMin - 5; playlistMax = playlistMin + 5
                    playlistSelected = playlistMax
                    
                    let embed = CreateEmbed(`${playlist.name}`, `${playlist.description || 'No playlist description provided.'}\n\n${getPlaylistDescription()}`, `Viewing Playlist`, interaction.member, null, null, null, null, { thumbnail: playlist.songs[playlistSelected - 1]?.coverArt || interaction.member.user.avatarURL() })
                
                    childInt.update({ embeds: [embed], components: getButtons(playlistMax, { selected: playlistSelected, playlistSongs: playlist.songs }), ephemeral: true }).then((msg) => { }).catch((err) => { log('Interaction Reply Error', err) })
    
                }
    
                else if (id === 'next-page') {
    
                    playlistMax = playlistMax + 5; playlistMin = playlistMax - 5
                    playlistSelected = playlistMin
                    
                    let embed = CreateEmbed(`${playlist.name}`, `${playlist.description || 'No playlist description provided.'}\n\n${getPlaylistDescription()}`, `Viewing Playlist`, interaction.member, null, null, null, null, { thumbnail: playlist.songs[playlistSelected - 1]?.coverArt || interaction.member.user.avatarURL()})
                    childInt.update({ embeds: [embed], components: getButtons(playlistMax, { selected: playlistSelected, playlistSongs: playlist.songs }), ephemeral: true }).then((msg) => { }).catch((err) => { log('Interaction Reply Error', err) })
    
                }
    
                else if (id === 'add') {
    
                    await childInt.deferUpdate().catch((err) => { log('Button Defer Error', err) })

                    let queue = process.meta.queues.get(interaction.guild.id)
                    if (!queue) {
                    
                        try { await checkJoinability(interaction.member, interaction.guild, 0) } catch (error) {
    
                            let joinableError = String(error.message)
                            return childInt.followUp({ embeds: [WarningEmbed("You can't use this button right now.", joinableError)], ephemeral: true })
                    
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
                            
                        let selectedSong = playlist.songs[playlistSelected - 1]
    
                        let resolvedSong

                        if (!selected?.urls?.ytURL) {
                            let bestYt = await convertSpToYt(selectedSong.sources.sp)
                            if (!bestYt) {
                                return childInt.followUp({ embeds: [ ErrorEmbed('This song could not be played.', 'This song\'s media is currently unaccessable to Ducky.' )], ephemeral: true }).catch((err) => { })
                            }
                            resolvedSong = new song(null, interaction.member, interaction.channel, null, null, bestYt, selectedSong.sources.sp)
                        }
                        else {
                            resolvedSong = new song(selectedSong, interaction.member, interaction.channel) // give as much data as possible
                        }
    
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
    
                else if (id === 'remove') {
        
                    let selectedSong = playlist?.songs[playlistSelected - 1]
                    let index = user.library.playlists.indexOf(playlist)
                    playlist?.songs.splice(playlist?.songs?.indexOf(selectedSong), 1)

                    if (playlist?.songs.length < 1) { }

                    else { user.library.playlists.insert(index, playlist) }
                    user.library.playlists.splice(index, 1)
                    user.save()

                    let embed = CreateEmbed(`${playlist.name}`, `${playlist.description || 'No playlist description provided.'}\n\n${getPlaylistDescription()}`, `Viewing Playlist`, interaction.member, null, null, null, null, { thumbnail: playlist.songs[playlistSelected - 1]?.coverArt || interaction.member.user.avatarURL()})
                
                    childInt.update({ embeds: [embed], components: getButtons(playlistMax, { selected: playlistSelected, playlistSongs: playlist.songs }), ephemeral: true }).then((msg) => { }).catch((err) => { log('Interaction Reply Error', err) })
            
                }
    
                else if (id === 'info') {
        
                    await childInt.deferUpdate().catch((err) => { log('Button Defer Error', err) })
                    
                    let selectedSong = playlist.songs[playlistSelected - 1]
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

            })

        }).catch((err) => { log('Interaction Reply Error', err) })

    }

}

async function execute_voice(args, queue, user) { 

    let resolvedUser = await getUser(user.id, process.meta.client)

    if (queue.songs.current) {
        resolvedUser.library.songs.push(new writeableSong(queue.songs.current))
        await resolvedUser.save()
        
        await queue.speak(`This song has been added to ${user.username}'s liked songs.`)

    }

    else { 

        await queue.speak(`Sorry ${user.username}, but there's no song playing. Play a song first to save it.`)

    }

} 

export { command, commandData, execute, execute_voice }
