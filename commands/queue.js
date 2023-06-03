'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputStyle, TextInputBuilder  } from 'discord.js'
import { wordChoice, formatDur, log, sleep, shuffle } from '../functions/misc.js'
import { CreateEmbed, WarningEmbed } from "../functions/interface.js"
import { playlist } from "../classes/playlist.js"
import { getUser } from '../classes/user.js'

const command = new Object()
command.name = 'queue'
command.description = `View and control the current, previous and upcoming songs.`
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 0

async function execute(interaction, resolvedUser, discordClient) {

    // Eventually add ability to view ghost queues and select previous songs 

    function onlyUnique(value, index, self) {
        return self.indexOf(value) === index;
    }

    function getEmbed(minValue = 0, maxValue = 5, selected = null) {
        
        const { previousDisplay, currentDisplay, upcomingDisplay } = queue.display(minValue, maxValue, selected)

        let dynamicDescription = new String()

        if (queue.features.autoplay) {
            dynamicDescription = 'AutoPlay is enabled.'
        }
        if (queue.loops.currentSong) {
            dynamicDescription = 'The current song is looped.'
        }
        if (queue.loops.entireQueue) {
            dynamicDescription = 'All upcoming songs are looped.'
        }
        if (queue.features.shuffle) {
            dynamicDescription = 'Songs are being recurringly shuffled.'
        }

        let combinedLength = 0; let allArtists = new Array()
        queue.songs.upcoming.forEach((song) => { combinedLength += song.duration.sec; allArtists.push(...song.artists) })
        combinedLength += queue.songs.current.duration.sec - (queue.players.music.currentResource.playbackDuration / 1000).toFixed()
        allArtists.push(...queue.songs.current.artists)

        let operand = 'next song'
        if (!queue.songs.upcoming[0]) { operand = 'queue ends' }

        allArtists = allArtists.filter(onlyUnique)
        
        const embed = CreateEmbed(`${interaction.guild.name}'s Queue`,
            `${queue.songs.upcoming.length + 1} active ${wordChoice(queue.songs.upcoming.length + 1, 'song')} • ${formatDur((combinedLength).toFixed())} min until finished • ${allArtists.length} unique ${wordChoice(allArtists.length, 'artist')}\n${dynamicDescription}`,
            `${queue.songs.current.timeLeft()} min until the ${operand}.`, interaction.member, null,
            [
                { name: 'Current', value: `${currentDisplay}`, inline: false }, // possibly add progress bar 
                { name: 'Previous', value: `${previousDisplay.join('\n')}`, inline: true },
                { name: 'Upcoming', value: `${upcomingDisplay.join('\n')}`, inline: true },
            ],
            null, null, { url: queue.url || queue.songs.current.urls.duckyURL }
        )

        return embed 

    }

    function getExtraButtons() { 

        let forwardDisable = false; let backDisable = false
        if (!queue.songs.upcoming[maxValue]) { forwardDisable = true }
        if (!queue.songs.upcoming[minValue - 1]) { backDisable = true }


        let loopId = process.meta.config.botSettings.buttons.loops.sentry
        if (queue.loops.currentSong) { loopId = process.meta.config.botSettings.buttons.loops.currentSong }
        if (queue.loops.entireQueue) { loopId = process.meta.config.botSettings.buttons.loops.entireQueue }

        let shuffleId = process.meta.config.botSettings.buttons.shuffle.sentry
        if (queue.features.shuffle) { shuffleId = process.meta.config.botSettings.buttons.shuffle.active }

        let row = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(shuffleId).setCustomId('shuffle')).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.lastPage).setCustomId('back-page').setDisabled(backDisable)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(loopId).setCustomId('loop')).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.nextPage).setCustomId('forward-page').setDisabled(forwardDisable)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.save).setCustomId('save'))
        return row

    }


    let queue = process.meta.queues.get(interaction.guild.id)
    if (!queue || !queue.songs.current) { return interaction.reply({ embeds: [WarningEmbed("Ducky is not playing anything in this server.", `To view the queue, join a voice channel and play a song first.`)], components: [], ephemeral: true }).catch(() => { }) }

    let currentIndex = 0; let minValue = 0; let maxValue = 5; 
    let downDisabled = true; let upDisabled = true; 

    if (queue.songs.upcoming.length > 0 || queue.songs.previous.length > 0) { downDisabled = false }

    let buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji('1041905151734190162').setCustomId('reset').setDisabled(true)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.up).setCustomId('up').setDisabled(upDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.down).setCustomId('down').setDisabled(downDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.next).setCustomId('next').setDisabled(true)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.remove).setCustomId('remove').setDisabled(true))
    interaction.reply({ embeds: [getEmbed()], components: [buttons, getExtraButtons()] }).then((msg) => { handleButtons(msg) }).catch((err) => { log('Reply Error', err) })

    async function handleButtons(msg) { 

        let collector = msg.createMessageComponentCollector({ time: 3600000 })

        collector.on('collect', async (childInt) => {

            let id = childInt.customId
            if (id !== 'save' || currentIndex !== 0) { await childInt.deferUpdate().catch((err) => { log('Button Defer Error', err) }) }

            if (id === 'down') { 

                let downDisabled = true; let upDisabled = false; let actionButtonsDisabled = true;

                if ((currentIndex + 1) > maxValue) { minValue = maxValue; maxValue = maxValue + 5; }

                currentIndex = currentIndex + 1
            
                actionButtonsDisabled = false
                if (queue.songs.upcoming.length > 0) { downDisabled = false }
                if (currentIndex >= queue.songs.upcoming.length) { downDisabled = true }
                if (currentIndex <= 0) { upDisabled = true; currentIndex = 0; maxValue = 5; minValue = 0; actionButtonsDisabled = true } 
            
                let buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji('1041905151734190162').setCustomId('reset').setDisabled(false)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.up).setCustomId('up').setDisabled(upDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.down).setCustomId('down').setDisabled(downDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.next).setCustomId('next').setDisabled(actionButtonsDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.remove).setCustomId('remove').setDisabled(actionButtonsDisabled))
                interaction.editReply({ embeds: [getEmbed(minValue, maxValue, currentIndex)], components: [buttons, getExtraButtons()] }).then((msg) => { }).catch((err) => { log('Reply Error', err) })
            
            }

            if (id === 'up') { 

                let downDisabled = true; let upDisabled = false; let actionButtonsDisabled = true; 

                if ((currentIndex - 1) <= minValue) { maxValue = maxValue - 5; minValue = maxValue - 5; }

                currentIndex = currentIndex - 1
            
                actionButtonsDisabled = false
                if (queue.songs.upcoming.length > 0) { downDisabled = false }
                if (currentIndex >= queue.songs.upcoming.length) { downDisabled = true }
                if (currentIndex <= 0) { upDisabled = true; currentIndex = 0; maxValue = 5; minValue = 0; actionButtonsDisabled = true } 
            
                let buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji('1041905151734190162').setCustomId('reset').setDisabled(false)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.up).setCustomId('up').setDisabled(upDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.down).setCustomId('down').setDisabled(downDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.next).setCustomId('next').setDisabled(actionButtonsDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.remove).setCustomId('remove').setDisabled(actionButtonsDisabled))
                interaction.editReply({ embeds: [getEmbed(minValue, maxValue, currentIndex)], components: [buttons, getExtraButtons()] }).then((msg) => { }).catch((err) => { log('Reply Error', err) })
                
            }

            if (id === 'next') { 

                let downDisabled = true; let upDisabled = true; 

                let selected = queue.songs.upcoming[currentIndex - 1]
                let indexOfSelected = queue.songs.upcoming.indexOf(selected)

                let removedSongs = queue.songs.upcoming.splice(0, indexOfSelected)
                let reversedRemoved = removedSongs.reverse()
                queue.songs.previous.push(...reversedRemoved)

                await queue?.players?.music?.player.stop()

                if (queue.songs.upcoming.length > 0) { downDisabled = false }
                currentIndex = 0; maxValue = 5; minValue = 0

                await sleep(350)

                let buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji('1041905151734190162').setCustomId('reset').setDisabled(true)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.up).setCustomId('up').setDisabled(upDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.down).setCustomId('down').setDisabled(downDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.next).setCustomId('next').setDisabled(true)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.remove).setCustomId('remove').setDisabled(true))
                interaction.editReply({ embeds: [getEmbed(minValue, maxValue, null)], components: [buttons, getExtraButtons()] }).then((msg) => { }).catch((err) => { log('Reply Error', err) })
                
            }

            if (id === 'remove') { 

                let downDisabled = true; let upDisabled = true; 

                let selected = queue.songs.upcoming[currentIndex - 1]
                let indexOfSelected = queue.songs.upcoming.indexOf(selected)

                let removedSongs = queue.songs.upcoming.splice(indexOfSelected, 1)
                queue.songs.previous.push(...removedSongs)

                if (queue.songs.upcoming.length > 0) { downDisabled = false }

                let buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji('1041905151734190162').setCustomId('reset').setDisabled(true)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.up).setCustomId('up').setDisabled(upDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.down).setCustomId('down').setDisabled(downDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.next).setCustomId('next').setDisabled(true)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.remove).setCustomId('remove').setDisabled(true))
                interaction.editReply({ embeds: [getEmbed(minValue, maxValue, null)], components: [buttons, getExtraButtons()] }).then((msg) => { }).catch((err) => { log('Reply Error', err) })
                
            }

            if (id === 'reset') { 

                let downDisabled = true; let upDisabled = true; 

                if (queue.songs.upcoming.length > 0) { downDisabled = false }
                currentIndex = 0; maxValue = 5; minValue = 0

                let buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji('1041905151734190162').setCustomId('reset').setDisabled(true)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.up).setCustomId('up').setDisabled(upDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.down).setCustomId('down').setDisabled(downDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.next).setCustomId('next').setDisabled(true)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.remove).setCustomId('remove').setDisabled(true))
                interaction.editReply({ embeds: [getEmbed(minValue, maxValue, null)], components: [buttons, getExtraButtons()] }).then((msg) => { }).catch((err) => { log('Reply Error', err) })
        
            }

            if (id === 'shuffle') { 

                if (queue.features.shuffle) {

                    queue.features.shuffle = false
                    queue.update()

                }

                else if (queue.features.goingToEnableShuffle) { 

                    queue.features.shuffle = true
                    queue.features.goingToEnableShuffle = false
                    queue.update()

                }

                else { 

                    queue.songs.upcoming = shuffle(queue.songs.upcoming)
                    queue.features.goingToEnableShuffle = true
                    queue.update()
                    try { childInt.followUp({ embeds: [CreateEmbed('All upcoming songs have been shuffled.', `To enable recurring shuffling, use the <:shuffleO:${process.meta.config.botSettings.buttons.shuffle.sentry}> button again within 10 seconds.`, 'Queue Actions', childInt?.member || null)], ephemeral: true }).catch(() => { }) } catch { }

                    setTimeout(() => { 

                        queue.features.goingToEnableShuffle = false
                        queue.update()

                    }, 10000)

                }

                let downDisabled = true; let upDisabled = true; 

                if (queue.songs.upcoming.length > 0) { downDisabled = false }
                currentIndex = 0; maxValue = 5; minValue = 0

                let buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji('1041905151734190162').setCustomId('reset').setDisabled(true)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.up).setCustomId('up').setDisabled(upDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.down).setCustomId('down').setDisabled(downDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.next).setCustomId('next').setDisabled(true)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.remove).setCustomId('remove').setDisabled(true))
                interaction.editReply({ embeds: [getEmbed(minValue, maxValue, null)], components: [buttons, getExtraButtons()] }).then((msg) => { }).catch((err) => { log('Reply Error', err) })

            }

            if (id === 'back-page') { 

                maxValue = maxValue - 5; minValue = maxValue - 5;
                currentIndex = minValue
                
                let downDisabled = true; let upDisabled = false; let actionButtonsDisabled = false; 
            
                if (queue.songs.upcoming.length > 0) { downDisabled = false }
                if (currentIndex >= queue.songs.upcoming.length) { downDisabled = true }
                if (currentIndex <= 0) { upDisabled = true; currentIndex = 0; actionButtonsDisabled = true } 
            
                let buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji('1041905151734190162').setCustomId('reset').setDisabled(false)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.up).setCustomId('up').setDisabled(upDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.down).setCustomId('down').setDisabled(downDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.next).setCustomId('next').setDisabled(actionButtonsDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.remove).setCustomId('remove').setDisabled(actionButtonsDisabled))
                interaction.editReply({ embeds: [getEmbed(minValue, maxValue, currentIndex)], components: [buttons, getExtraButtons()] }).then((msg) => { }).catch((err) => { log('Reply Error', err) })

            }

            if (id === 'forward-page') { 

                minValue = maxValue; maxValue = maxValue + 5;
                currentIndex = minValue

                let downDisabled = true; let upDisabled = false; let actionButtonsDisabled = false; 
            
                if (queue.songs.upcoming.length > 0) { downDisabled = false }
                if (currentIndex >= queue.songs.upcoming.length) { downDisabled = true }
                if (currentIndex <= 0) { upDisabled = true; currentIndex = 0; actionButtonsDisabled = true } 
            
                let buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji('1041905151734190162').setCustomId('reset').setDisabled(false)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.up).setCustomId('up').setDisabled(upDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.down).setCustomId('down').setDisabled(downDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.next).setCustomId('next').setDisabled(actionButtonsDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.remove).setCustomId('remove').setDisabled(actionButtonsDisabled))
                interaction.editReply({ embeds: [getEmbed(minValue, maxValue, currentIndex)], components: [buttons, getExtraButtons()] }).then((msg) => { }).catch((err) => { log('Reply Error', err) })

            }

            if (id === 'loop') { 

                if (queue.loops.currentSong) {
                    
                    queue.loops.currentSong = false
                    queue.loops.entireQueue = true

                }

                else if (queue.loops.entireQueue) {

                    queue.loops.currentSong = false
                    queue.loops.entireQueue = false

                }

                else {

                    queue.loops.currentSong = true
                }

                let downDisabled = true; let upDisabled = false; let actionButtonsDisabled = false; 
            
                if (queue.songs.upcoming.length > 0) { downDisabled = false }
                if (currentIndex >= queue.songs.upcoming.length) { downDisabled = true }
                if (currentIndex <= 0) { upDisabled = true; currentIndex = 0; maxValue = 5; minValue = 0; actionButtonsDisabled = true } 
            
                let buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji('1041905151734190162').setCustomId('reset').setDisabled(false)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.up).setCustomId('up').setDisabled(upDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.down).setCustomId('down').setDisabled(downDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.next).setCustomId('next').setDisabled(actionButtonsDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.remove).setCustomId('remove').setDisabled(actionButtonsDisabled))
                interaction.editReply({ embeds: [getEmbed(minValue, maxValue, currentIndex)], components: [buttons, getExtraButtons()] }).then((msg) => { }).catch((err) => { log('Reply Error', err) })

            }

            if (id === 'save') { 

                let resolvedUsr = await getUser(childInt.user.id, process.meta.client)

                if (currentIndex === 0) {

                    const modal = new ModalBuilder().setCustomId('namePlaylist').setTitle('Customize Playlist')
        
                    const nameInput = new TextInputBuilder().setCustomId('name').setLabel("Enter a name for this playlist.").setStyle(TextInputStyle.Short).setRequired(true).setMinLength(2).setMaxLength(35);
                    const descriptionInput = new TextInputBuilder().setCustomId('description').setLabel("Enter a description for this playlist.").setStyle(TextInputStyle.Short).setMinLength(5).setMaxLength(150).setRequired(false);

                    const actionRow = new ActionRowBuilder().addComponents(nameInput)
                    const nextRow = new ActionRowBuilder().addComponents(descriptionInput)
                    modal.addComponents(actionRow, nextRow)

                    childInt.showModal(modal)

                    childInt.awaitModalSubmit({ time: 300000  })
                        
                        .then(async (modalInt) => {

                            const name = modalInt.fields.getTextInputValue('name')
                            const description = modalInt.fields.getTextInputValue('description')

                            const resolvedPlaylist = new playlist(null, modalInt.user.username, { name: name, description: description })
                            resolvedPlaylist.addResolvedSongs([queue.songs.current, ...queue.songs.upcoming])
                        
                            resolvedPlaylist.convertToWritable() // make it not throw circular errors, much more to this though 
                            let libAmt = resolvedUser.addResolvedPlaylist(resolvedPlaylist)
                            resolvedUser.save()
                        
                            await modalInt.deferUpdate().catch((err) => { log('Modal Defer Error', err) })
                            await modalInt.followUp({ embeds: [CreateEmbed('Added this queue to your saved playlists.', `You now have ${libAmt} saved ${wordChoice(libAmt, 'playlist')}.`, `${childInt.user.username}'s Library`, childInt.member)], ephemeral: true }).catch((err) => { log('Interaction Error', err) })
                        
                        }).catch((err) => { (log('Modal Error', err)) }) 
                 }

                else {

                    let selectedSong = queue.songs.upcoming[currentIndex - 1]

                    let includes = false
                    resolvedUsr.library.songs.forEach((savedSong) => { if (savedSong?._internalId === selectedSong._internalId) { includes = true } })
    
                    if (!includes) {
    
                        let libAmt = await resolvedUsr.addSongToLibrary(selectedSong)
    
                        await childInt.followUp({ embeds: [CreateEmbed('Added this song to your liked songs.', `You now have ${libAmt} liked ${wordChoice(libAmt, 'song')}.\nUse the <:save:${process.meta.config.botSettings.buttons.save}> button again to remove this song from your liked songs.`, `${childInt.user.username}'s Library`, childInt.member)], ephemeral: true }).catch((err) => { log('Interaction Error', err) })
    
                    }
    
                    else {
    
                        let libAmt = await resolvedUsr.removeSongFromLibrary(selectedSong._internalId)
    
                        await childInt.followUp({ embeds: [CreateEmbed('Removed this song from your liked songs.', `You now have ${libAmt} liked ${wordChoice(libAmt, 'song')}.`, `${childInt.user.username}'s Library`, childInt.member)], ephemeral: true }).catch((err) => { log('Interaction Error', err) })
    
                    }

                }
                    
            }

        })

    }
    
}

export { command, commandData, execute }