'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { CreateEmbed, ErrorEmbed, WarningEmbed } from './functions/interface.js'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { EndBehaviorType } from '@discordjs/voice'
import { log, sleep } from './functions/misc.js'
import { pipeline, Readable } from 'stream'
import prism from 'prism-media'
import pkg from 'node-wit'

const { Wit } = pkg
let lastCall = null

const witClient = new Wit({ accessToken: process.meta.config.apiKeys.wit })

export function handleEvents(guildId) {

    let queue = process.meta.queues.get(guildId)
    if (!queue) { return }

    queue.events.on('SongFinished', async (inTransition) => {

        if (queue.state === 'stopping' || inTransition) { return }

        queue.inTransition = false
        queue.clearLyrics()

        Array.prototype.insert = function (index, item) { this.splice(index, 0, item) }

        if (queue.loops.currentSong) {
            queue.songs.current._internalId = queue.songs.current.getNewInternalID()
            if (queue.songs.previous[queue.songs.previous.length - 1]?.ids?.duckyID !== queue.songs.current?.ids?.duckyID) {
                queue.songs.previous.push(queue.songs.current)
            }
            queue.play()
        }

        else if (!queue.songs.upcoming[0] && queue.songs.current && !queue.loops.currentSong) {

            if (queue.loops.entireQueue) {

                for (const song of queue.songs.previous) { queue.songs.previous[queue.songs.previous.indexOf(song)]._internalId = song.getNewInternalID() }

                if (queue.songs.current) queue.songs.previous.push(queue.songs.current)
                queue.songs.current = queue.songs.previous.shift()
                queue.songs.upcoming = queue.songs.previous
                
                queue.play()
                
                await queue.textChannel.send({ embeds: [CreateEmbed('The queue is currently looped.', 'All previous songs have been rotated to the upcoming queue.', 'System Notifications', false, '42ed8f')], components: [] }).then((msg) => { }).catch()
                
                queue.textChannel.send({ embeds: [queue.songs.current.getEmbed(false, 'np')], components: queue.getPlayButtons(queue.songs.current) }).then((msg) => { if (msg) queue.handleStdButtonIds(msg, queue.songs.current) }).catch()

            }

            else if (queue.features.autoplay) { 

                let suggestedSong = await queue.songs.current.getSuggestedSong().catch((err) => {
                    log('Suggested Song Search Error', err)
                })
                if (!suggestedSong) { 
                    return queue.textChannel.send({ embeds: [WarningEmbed('No more suggested songs could be found.', 'AutoPlay is enabled, however no more songs will play.')], components: [] }).then((msg) => { }).catch()
                }

                if (queue.songs.current) queue.songs.previous.push(queue.songs.current)
                queue.songs.current = null

                queue.songs.current = suggestedSong
                queue.update()

                queue.textChannel.send({ embeds: [queue.songs.current.getEmbed(false, 'np')], components: queue.getPlayButtons(queue.songs.current) }).then((msg) => { if (msg) queue.handleStdButtonIds(msg, queue.songs.current) }).catch()
    
                queue.play()
    
             }

            else {

                if (queue.songs.current) queue.songs.previous.push(queue.songs.current)
                queue.songs.current = null

                let notifRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('disconnect').setEmoji(process.meta.config.botSettings.buttons.dc).setStyle(ButtonStyle.Secondary)).addComponents(new ButtonBuilder().setCustomId('autoplay').setEmoji(process.meta.config.botSettings.buttons.autoplay).setStyle(ButtonStyle.Secondary))
                queue.textChannel.send({ embeds: [CreateEmbed('There are no more songs in the queue.', 'The next song queued will play immediately.', 'System Notifications', false, '42ed8f')], components: [notifRow] }).then((msg) => { if (msg) queue.handleStdButtonIds(msg, null) }).catch()
                if (queue.songs.previous[queue.songs.previous.length - 1]?.meta?.voice) { try { queue.speak('There are no more songs in the queue.') } catch { } }
            }

        }

        else if (queue.songs.upcoming[0]) {

            if (queue.features.shuffle) { queue.shuffle() }

            if (queue.songs.current) queue.songs.previous.push(queue.songs.current)
            queue.songs.current = queue.songs.upcoming[0]
            queue.songs.upcoming.splice(queue.songs.upcoming.indexOf(queue.songs.current), 1)
            queue.update()

            queue.textChannel.send({ embeds: [queue.songs.current.getEmbed(false, 'np')], components: queue.getPlayButtons(queue.songs.current) }).then((msg) => { if (msg) queue.handleStdButtonIds(msg, queue.songs.current) }).catch()

            queue.play()

        }
    
    })

    queue.events.on('NewLyricLine', async (line, msg, description) => {

        let placeholder = `<:instrumental:${process.meta.config.botSettings.buttons.instrumentalPlaceholder}>`

        if (queue.lyrics.typeInProgress == 'mini') {
        
            if (line.next.timeInMs == 'CREDITS') { // This is the last line of the lyrics 

                await sleep(5000)
        
                msg.edit({ embeds: [CreateEmbed('Credits', line.next?.words, 'Flowing Lyrics', null, '1cfaa4', null, 'Lyrics Provided By Spotify', true)] }).catch((err) => {
                    log('Lyrics Edit Error', err);
                    queue.clearLyrics()
                })

            }
        
            else {
                msg.edit({ embeds: [CreateEmbed(line.current?.words || placeholder, null, line.next?.words == placeholder ? '♫' : line.next?.words || 'Flowing Lyrics', null, '1cfaa4', null, line.last?.words == placeholder ? '♫' : line.last?.words || 'Provided By Spotify', true)] }).catch((err) => {
                    log('Lyrics Edit Error', err);
                    queue.clearLyrics()
                })
                
            }
        }

        else {

            let disableUp = true; let disableDown = false; let disableNext = true
            if (!description) { return } // this is only here to prevent reading errs
            
            let currentSelected; let combinedDescription = new Array()
            let currentDescription = description.find(entry => entry.timeInMs === line.current.timeInMs)
            if (queue.lyrics.selectedVerse) { disableNext = false; currentSelected = description.find(entry => entry.timeInMs === queue.lyrics.selectedVerse.timeInMs) }

            for (const entry of description) {

                let toPush = entry.description
                if (entry.timeInMs === currentSelected?.timeInMs) { toPush = entry.selected }
                if (entry.timeInMs === currentDescription?.timeInMs) {
                    if (toPush === entry.selected) { toPush = entry.activeSelected }
                    else { toPush = entry.active }
                }
                combinedDescription.push(toPush)
            }

            if (currentDescription !== description[0]) { disableUp = false }
            if (currentDescription === description[description.length - 1]) { disableDown = true }
            
            queue.lyrics.description = description
            queue.lyrics.currentLine = currentDescription

            if (combinedDescription.join('\n')?.length > 3999) {
                msg?.interaction?.editReply({ embeds: [ErrorEmbed('Interactive Lyrics for this song exceed the max displayable length.', `Please use Flowing Lyrics, via the <:lyrics:${process.meta.config.botSettings.buttons.lyrics}> buttons.`)] }).catch((err) => {
                    log('Lyrics Edit Error', err);
                    queue.clearLyrics()
                })
                queue.clearLyrics()
                return
            }

            let buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.reset).setCustomId('reset').setDisabled(false)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.up).setCustomId('up').setDisabled(disableUp)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.down).setCustomId('down').setDisabled(disableDown)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.next).setCustomId('next').setDisabled(disableNext))
            msg?.interaction?.editReply({ embeds: [CreateEmbed(queue.songs.current.titles.display.normal, combinedDescription.join('\n'), 'Interactive Lyrics', msg?.member, false, false, 'Lyrics Provided By Spotify')], components: [buttons] }).catch((err) => {
                log('Lyrics Edit Error', err);
                queue.clearLyrics()
            })

            if (description.indexOf(currentDescription) === description.length - 1) {

                await sleep(5000)

                let buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.reset).setCustomId('reset').setDisabled(true)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.up).setCustomId('up').setDisabled(true)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.down).setCustomId('down').setDisabled(true)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.next).setCustomId('next').setDisabled(true))
                msg?.interaction?.editReply({ embeds: [CreateEmbed(queue.songs.current.titles.display.normal, `Displaying credits for this song.\n\n${queue.lyrics.credits || 'No credits are available for this track.'}`, 'Interactive Lyrics', msg?.member, false, false, 'Lyrics Provided By Spotify')], components: [buttons] }).catch((err) => {
                    log('Lyrics Edit Error', err);
                })
    
                return
            }
            
        }

    })

    queue.events.on('StartSpeaking', async (user) => {

        if (queue.speaking.users.length > 25) { queue.speaking.users = new Array() }
        queue.speaking?.users?.push({ id: user.id, time: 0, interval: null })
        if (queue.modes.dynamic) {

            let timeInterval = setInterval(() => {

                if (!queue?.speaking?.users) { clearInterval(timeInterval) }
                queue.speaking.users.find(res => res.id === user.id).time += 250

            }, 250)

            queue.speaking.users.find(res => res.id === user.id).interval = timeInterval
        }

        if (process.meta.config.misc.voiceCommandsEnabled) {

            const opusStream = queue.connection.receiver?.subscribe(user.id, {
                objectMode: false,
                end: {
                    behavior: EndBehaviorType.AfterSilence,
                    duration: 100,
                },
            })

            const decoder = new prism.opus.Decoder({ frameSize: 960, channels: 1, rate: 48000 })

            const audio = pipeline(opusStream, decoder, () => { decoder.destroy(); opusStream.destroy() })

            const allBuffers = new Array()

            for await (const buffer of audio) {
                allBuffers.push(buffer)
            }

            let buffer = Buffer.concat(allBuffers)
            const duration = buffer.length / 48000 / 2

            if (duration < 1.10 || duration > 6.9) { return } // ignore audio that is too short or long
        
            const type = "audio/raw;encoding=signed-integer;bits=16;rate=48k;endian=little" 

            const stream = Readable.from(buffer)

            if (lastCall) {
                let now = Math.floor(new Date())
                while (now - lastCall < 1000) {
                    await sleep(100);
                    now = Math.floor(new Date())
                }
            }

            const result = await witClient.speech(type, stream).catch((err) => { })

            stream.destroy()
            buffer = null

            if (process.meta.config.misc.debug) { log(`${user.username} Transcription`, result?.text, true) }

            lastCall = Math.floor(new Date())

            if (!result?.text) { /* an error happened? */ }
            else {
                queue.routeVoiceCommands(result?.text?.toLowerCase(), user)
            }

        }
        
     })

    queue.events.on('StopSpeaking', async (user) => {

        try { clearInterval(queue.speaking.users.find(res => res.id === user.id).interval) } catch (err) { }
        queue.speaking?.users?.splice(queue.speaking?.users?.indexOf(queue.speaking?.users?.find(res => res.id === user.id)), 1)

    })

    queue.events.on('SongPlaying', async () => { 

        // if (!queue.cached?.audioResources[queue.songs.current.ids.duckyID] && queue.cached?.audioResources) { queue.cached.audioResources[queue.songs.current.ids.duckyID] = queue.players.music.currentResource }
        // Complete Eventually, maybe in a future update 

    })

    queue.events.on('SongError', async (erroredSong, error) => {
    
        log('Play Error', error?.message || error)
        console.error(error)

        let errorRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('disconnect').setEmoji(process.meta.config.botSettings.buttons.dc).setStyle(ButtonStyle.Secondary)).addComponents(new ButtonBuilder().setCustomId('forget').setEmoji(process.meta.config.botSettings.buttons.forget).setStyle(ButtonStyle.Secondary))
        queue.textChannel.send({ embeds: [ErrorEmbed(`Something went wrong while playing "${erroredSong?.titles?.display?.normal || "the last song"}"`, `The song has been skipped.\nPlease [contact support](${process.meta.config.misc.links.support}) if this error persists.`)], components: [errorRow] }).then((msg) => { }).catch()

        queue.skip()

     })
 
    queue.events.on('SongAdded', async (song, silent) => {

        if (process.meta.config.misc.debug) { log(`Song Added`, `${song?.titles?.display?.normal || 'Unknown'} has been added to ${process.meta.client?.guilds?.cache?.get(queue.parent)?.name || queue.parent}'s queue.`) }

    })
    
}
