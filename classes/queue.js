'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { createAudioPlayer, NoSubscriberBehavior, joinVoiceChannel, VoiceConnectionStatus, entersState, StreamType, createAudioResource, AudioPlayerStatus } from '@discordjs/voice'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js'
import { getExistingDBEntry, createDBEntry, removeDBentry, overwriteDBEntry } from '../functions/data.js'
import { log, sleep, wordChoice, formatDur, limit, sentenceCase } from '../functions/misc.js'
import { CreateEmbed, ErrorEmbed, WarningEmbed } from '../functions/interface.js'
import { writeableSong, song } from './song.js'
import tts from '@google-cloud/text-to-speech'
import { handleEvents } from '../events.js'
import { playlist } from './playlist.js'
import { getServer } from './server.js'
import { customAlphabet } from 'nanoid'
import { EventEmitter } from 'events'
import { getUser } from './user.js'
import { Readable } from 'stream'
import { DateTime } from 'luxon'
import fs from 'fs'

const ttsClient = new tts.TextToSpeechClient({ keyFile: './resources/keys/speech.json' })

export function getQueue(guildId, voiceChannel, textChannel) {

    // update to sync function 

    let cached = process.meta.queues.get(guildId)
    if (cached) {
        cached.update('textChannel', textChannel)
        cached.update('voiceChannel', voiceChannel)
        return cached
    }

    let server = getServer(guildId, process.meta.client); if (!server) { throw new Error('Could not resolve this guild.'); }
    let existingQueue = getExistingDBEntry(guildId, 'queues')
    let resolvedQueue = new queue(existingQueue, voiceChannel, textChannel, server)
    if (resolvedQueue.error) { throw new Error(resolvedQueue.error) }
    if (!existingQueue) { resolvedQueue.create() }

    if (resolvedQueue.songs.current) { resolvedQueue.play() } // check to make sure this is in the correct spot, ig

    return resolvedQueue

}
export default class queue {

    constructor(existingQueue, voiceChannel, textChannel, server) {

        if (!existingQueue && !server) { return this.error = true }
        else if (!voiceChannel) { return this.error = true }

        if (existingQueue?.songs?.current) { 

            existingQueue.songs.current = new song(existingQueue.songs.current)

        }

        if (existingQueue?.songs?.previous?.length > 0) { 

            for (const fetchedSong of existingQueue.songs.previous) { 

                existingQueue.songs.previous[existingQueue.songs.previous.indexOf(fetchedSong)] = new song(fetchedSong)

            }

        }

        if (existingQueue?.songs?.upcoming?.length > 0) { 

            for (const fetchedSong of existingQueue.songs.upcoming) { 

                existingQueue.songs.upcoming[existingQueue.songs.upcoming.indexOf(fetchedSong)] = new song(fetchedSong)

            }

        }

        this.volume = 1
        this.url = `${process.meta.config.misc.apiDomain}/queue?${voiceChannel.guild.id}`
        this._internalId = getNewInternalID()
        this.state = 'idle'
        this.locked = false
        this.connection = null
        this.currentPlayer = ''
        this.modes = existingQueue?.modes || { normal: true, spatial: false, dynamic: false }
        this.events = new EventEmitter()
        this.voiceChannel = voiceChannel
        this.parent = existingQueue?.parent || server.serverID
        this.cached = { nextSong: null, audioResources: [], voiceRecognizer: null }
        this.songs = existingQueue?.songs || { current: null, previous: [], upcoming: [] }
        this.effects = existingQueue?.effects || { applied: false, spatialArgs: [] }
        this.availableEffects = { rotate: { name: "Rotate Audio", backend: "rotate", description: `Audio will rotate from ear-to-ear every 8 seconds.` }, speedup: { name: "Speed Up", backend: "speedup", description: `Audio will sound and play faster. This will desync lyrics.` }, slowdown: { name: "Slow Down", backend: "slowdown", description: `Audio will sound and play slower. This will desync lyrics.` }, vocals: { name: "Boost Vocals", backend: "vocals", description: `Vocals will be split into multiple audio channels.` }, bass: { name: "Bass Boost", backend: "bass", description: 'Bass and lower notes will be much more prominent.' }, chorus: { name: "Intensify Chrous", backend: "chorus", description: 'Any chorus will be boosted and rendered in multiple audio channels.' }, desilencer: { name: "Desilencer", backend: "desilencer", description: 'Quieter parts of the song will be boosted.' }, karaoke: { name: "Karaoke", backend: "karaoke", description: `Vocals will be minimized to the best of Ducky's ability.` }  }
        this.loops = { currentSong: false, entireQueue: false }
        this.features = existingQueue?.features || { radio: false, autoplay: false, shuffle: false, goingToEnableShuffle: false, softVol: server?.settings?.softVolume }
        this.players = { music: { player: createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } }), subscription: null, currentResource: null }, speech: { player: createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Stop } }), subscription: null }, sounds: { player: createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Stop } }), subscription: null } }
        this.textChannel = textChannel || process.meta.client.guilds?.cache?.get(this.parent)?.channels?.cache?.get(existingQueue?.textChannelID) || null
        this.recording = { enabled: server?.settings?.enableClips || true, listener: { name: null, callback: null} }
        this.transitions = { switchingSources: false, pendingSync: false, tts: false, sb: false }
        this.lyrics = { lyricsInProgress: false, interval: null, typeInProgress: null, selectedVerse: null, credits: null }
        this.speaking = { users: new Array(), masterInterval: null }
        this.parentSettings = server.settings
        this.inTransition = false
        this.firstCreated = false

        process.meta.queues.set(server.serverID, this)

        this.handleAudioEvents()
        this.handleDynamicAudio()
        handleEvents(this.parent)

    }

    async create() {

        const queueToWrite = new writableQueue(this)
        let result = await queueToWrite.createEntry()
        if (!result) { return false } else return true

    }

    async update(key, value) {

        if (key && value) this[key] = value
        const queueToWrite = new writableQueue(this)
        let result = queueToWrite.updateEntry()
        if (!result) { return false } else return true

    }

    async handleAudioEvents() {

        this.players.music.player.on('idle', () => {

            this.events.emit('SongFinished', this.inTransition)
            if (process.meta.config.misc.debug) { log(`Song Finished`, `${process.meta.client?.guilds?.cache?.get(this.parent)?.name || this.parent} has entered the idle audio state.`) }
            this.update('state', 'idle')

        })

        this.players.music.player.on('buffering', () => {

            this.events.emit('SongLoading', this.songs?.current || null)
            if (process.meta.config.misc.debug) { log(`Song Loading`, `${process.meta.client?.guilds?.cache?.get(this.parent)?.name || this.parent} has entered the loading audio state.`) }
            this.update('state', 'buffering')

        })

        this.players.music.player.on('playing', () => {

            this.events.emit('SongPlaying', this.songs?.current || null)
            if (process.meta.config.misc.debug) { log(`Song Playing`, `${process.meta.client?.guilds?.cache?.get(this.parent)?.name || this.parent} has entered the playing audio state.`) }
            this.state = 'playing'
            this.update('state', 'playing')

        })

        this.players.music.player.on('paused', () => {

            this.events.emit('SongPaused', this.songs?.current || null)
            if (process.meta.config.misc.debug) { log(`Song Paused`, `${process.meta.client?.guilds?.cache?.get(this.parent)?.name || this.parent} has entered the paused audio state.`) }
            this.update('state', 'paused')

        })

        this.players.music.player.on('error', (error) => {

            this.events.emit('SongError', this.songs?.current || null, error)
            if (process.meta.config.misc.debug) { log(`${process.meta.client?.guilds?.cache?.get(this.parent)?.name || this.parent} Song Error`, error) }
            this.update('state', 'idle')

        })

    }

    clearLyrics() {

        clearInterval(this.lyrics?.interval)
        this.lyrics.interval = null
        this.lyrics.lyricsInProgress = false
        this.lyrics.selectedVerse = null
        this.lyrics.typeInProgress = null
        this.lyrics.currentLine = null
        this.lyrics.description = null
        this.credits = null

        return true

    }

    async connect(wait = false) {

        const voiceConnection = joinVoiceChannel({
            channelId: this.voiceChannel.id,
            selfDeaf: true,
            guildId: this.parent,
            adapterCreator: this.voiceChannel.guild.voiceAdapterCreator
        })

        this.connection = voiceConnection

        voiceConnection.on('error', (error) => { log(`${process.meta.client?.guilds?.cache?.get(this.parent)?.name || this.parent} Voice Error`, error) })

        voiceConnection.on(VoiceConnectionStatus.Connecting, () => { if (process.meta.config.misc.debug) log(`Connecting`, `${process.meta.client?.guilds?.cache?.get(this.parent)?.name || this.parent} has entered the connecting state.`) })

        voiceConnection.on(VoiceConnectionStatus.Signalling, () => { if (process.meta.config.misc.debug) log(`Signalling`, `${process.meta.client?.guilds?.cache?.get(this.parent)?.name || this.parent} has entered the signalling state.`) })

        voiceConnection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {

            if (process.meta.config.misc.debug) log(`Disconnected`, `${process.meta.client?.guilds?.cache?.get(this.parent)?.name || this.parent} has entered the disconnected state.`)

            try {

                await Promise.race([

                    entersState(voiceConnection, VoiceConnectionStatus.Signalling, 500),
                    entersState(voiceConnection, VoiceConnectionStatus.Connecting, 500), // change timeout to 500 ms 

                ]);

            } catch (error) {

                if (process.meta.config.misc.debug) log(`Disposing`, `Recycling the connection for ${process.meta.client?.guilds?.cache?.get(this.parent)?.name || this.parent}.`)
                voiceConnection.destroy();
                process.meta.queues.delete(this.textChannel.guild.id)

                this.textChannel.send({ embeds: [CreateEmbed('Voice Session Ended', `Ducky has been forcefully disconnected from **${this.voiceChannel?.name || 'your call'}**.\nAny settings changed have been saved.`, 'System Notifications', false, '42ed8f')], components: [] }).then((msg) => {  }).catch(() => { })
                this.destroy()


            }

        })

        voiceConnection.once(VoiceConnectionStatus.Ready, async () => {
            if (process.meta.config.misc.debug) { log('Connected', `${process.meta.client?.guilds?.cache?.get(this.parent)?.name || this.parent} has entered the connected state.`) }
            this.connection = voiceConnection;
            this.switchPlayer()

            this.events.emit("Connected")

            this.connection.receiver.speaking.on('start', (userID) => { 
                let speakingUser = process.meta.client.users.cache.get(userID) || null
                this.events.emit('StartSpeaking', speakingUser)
            })
    
            this.connection.receiver.speaking.on('end', (userID) => { 
                let speakingUser = process.meta.client.users.cache.get(userID) || null
                this.events.emit('StopSpeaking', speakingUser)
            })

        })

        let checkInterval = setTimeout(() => {
            if (!this.connection) { clearInterval(checkInterval) }
            if (this.connection?.state !== 'startup') { clearInterval(checkInterval) }
            if (this.connection?.state === 'startup') {
                voiceConnection.destroy(); this.connection = null; throw new Error('Failed to connect after 10 seconds.')
            }
        }, 10000)

        if (wait) { 

            await entersState(voiceConnection, VoiceConnectionStatus.Ready, 10_000).catch((err) => { return false })
            return true

        } 

    }

    disconnect() {

        if (!this.connection || this.connection.state === 'startup') { throw new Error('Proper connection does not exist.') }

        this.connection.destroy()

        this.connection = null
        this.update('connection', this.connection) 

        // add any other methods here 

    }

    add(song, silent = null) {

        this.events.emit('SongAdded', song, silent)

        if (!this.songs.current) { this.songs.current = song; this.update('songs', this.songs); this.transitions.pendingSync = false; return 0 }
        else { this.songs.upcoming.push(song); this.update('songs', this.songs); return this.songs.upcoming.indexOf(song) + 1 }

    }

    remove(song) {

        if (this.songs.current === song) { this.skip(); return 0 }
        else if (this.songs.upcoming.includes(song)) {
            let index = this.songs.upcoming.indexOf(song)
            this.songs.upcoming.splice(index, 1)
            return index
        }

    }

    setTransition() { 

        if (this.inTransition) { this.inTransition = false }
        else { this.inTransition = true }

    }

    async destroy(db = false) {

        if (db) await removeDBentry(this.parent)
        process.meta.queues.delete(this.parent)
        clearInterval(this.speaking.masterInterval)
        this.archived = true
        try { this.events?.removeAllListeners(['SongFinished', 'SongLoading', 'SongPlaying', 'SongPaused', 'SongError']) } catch (err) { log('Events Error', err) }
        return

    }

    setAutoplay() {

        if (this.features.autoplay) { this.features.autoplay = false; this.update('autoplay', this.autoplay); return { enabled: false } }
        else if (!this.features.autoplay) { this.features.autoplay = true; this.update('autoplay', this.autoplay); return { enabled: true } }

    }

    async play(songPosition = 0, seek = 0, force = false, args = []) {

        this.switchPlayer('music')

        if (this.state === 'paused') { this.resume() }

        let song; let audioResource
        if (songPosition === 0) { song = this.songs.current }
        else { song = this.songs.upcoming[songPosition - 1] }

        try { audioResource = await song?.getAudioResource(seek, force, args) } catch (err) { throw new Error(err) }
        
        let musicPlayer = this.players.music.player
        this.players.music.currentResource = audioResource

        musicPlayer.play(audioResource) // Actually plays the song
        if (this.songs.current.type !== 'arbitrary') { this.restoreMode() } else { this.switchMode() /* resets the mode */ }

        return true

    }

    async pause(force = false) {

        if (!force) {
            this.fade()

            this.inTransition = true
            let checkInt = setInterval(() => {
                if (!this.inTransition) {
                    clearInterval(checkInt); this.players.music.player.pause()
                }
            }, 50)

        }

        else {
            this.players.music.player.pause()
        }

        this.update('state', 'paused')

    }

    async resume() {

        this.update('state', 'playing')

        this.volume = this.oldVol || 1
        this.setVolume(0)
        this.players.music.player.unpause()
        this.setVolume(this.volume)

    }

    async setVolume(volume = 1) {

        try { this.players.music.currentResource.volume.setVolume(volume) } catch (err) { log('Volume Error', err); throw new Error("The current audio resource refused to have it's volume changed.\nIf you are playing media from an unsupported URL, volume controls may be unavailable.") }

    }

    switchPlayer(player = 'music', customPlayer = null) {

        for (const [key, obj] of Object.entries(this.players)) { 

            if (obj.subscription) { 

                obj.subscription.unsubscribe()

            }
        }

        let subscription = this.connection.subscribe(this.players[player]?.player || customPlayer)
        if (!this.players[player]) {
            this.players[player] = new Object()
            this.players[player].player = customPlayer
        }
        this.players[player].subscription = subscription
        return true
    }

    switchMode(force = 'none') { 

        if (this.modes.normal || force === 'dynamic') {
            
            this.modes.normal = false; this.modes.dynamic = true

        }
        
        else if (this.modes.dynamic || force === 'spatial') {

            this.modes.dynamic = false; this.modes.spatial = true

            this.enableSpatial()

        }
        
        else if (this.modes.spatial || force === 'normal') {

            this.modes.spatial = false; this.modes.normal = true

            this.effects.spatialArgs = []
            this.songs.current.ffmpeg() // resets everything 

        }

        return this.modes

    }

    restoreMode() { 

        if (this.modes.spatial) { this.enableSpatial() }

    }

    enableSpatial() { 

        let ffmpegOptions = [ '-af', `surround,dynaudnorm=f=200` ]

        this.effects.spatialArgs = ffmpegOptions
        this.songs.current.ffmpeg(null, ffmpegOptions).catch((err) => {})

    }

    handleDynamicAudio() { 

        let queue = this // for nested functions
        this.speaking.masterInterval = setInterval(() => { 

            if (!queue.modes.dynamic && !(this.volume == 1)) {

                if (queue?.players?.music?.player) {
                    queue?.players?.music?.currentResource?.volume?.setVolume(1)
                    this.volume = 1
                }

            }
            
            else if (!queue.modes.dynamic) { }

            else { 

                if (queue.speaking.users.length > 0) { 

                    let shouldChange = false 
                    for (const speakingPartial of queue.speaking.users) { 
                        if (speakingPartial.time >= 1350) { 
                            shouldChange = true

                        }
                    }
                    if (shouldChange) {
                        if (this.volume !== 0.30) {
                            queue?.players?.music?.currentResource?.volume?.setVolume(0.3)
                        } 
                        this.volume = 0.30
                    }
                }

                else { 

                    if (queue?.players?.music?.player) {
                        if (this.volume !== 1) {
                            queue?.players?.music?.currentResource?.volume?.setVolume(1)
                            this.volume = 1
                        }
                    }

                }


            }

        }, 100)


    }

    async speak(text) {

        if (this.transitions.tts) {
            while (this.transitions.tts) {

                await sleep(100)

            }
        }
        
        this.switchPlayer('speech')
        this.transitions.tts = true 

        const reqOptions = { 

            input: { text: text },
            voice: { languageCode: 'en-US', name: 'en-US-Neural2-J' },
            audioConfig: { audioEncoding: 'OGG_OPUS' },

        }

        const [response] = await ttsClient.synthesizeSpeech(reqOptions)
        
        const stream = Readable.from(response.audioContent, 'binary')

        const resource = createAudioResource(stream, { inputType: StreamType.OggOpus })

        this.players.speech.player.play(resource) 

        this.players.speech.player.once(AudioPlayerStatus.Idle, () => { 

            this.switchPlayer()
            this.transitions.tts = false 

        }).on(AudioPlayerStatus.Error, () => {
           
            this.switchPlayer()
            this.transitions.tts = false 

        })

    }

    shuffle(recurring = false) {

        function shuffle(a) { var j, x, i; for (i = a.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); x = a[i]; a[i] = a[j]; a[j] = x; } return a; }

        this.songs.upcoming = shuffle(this.songs.upcoming)

        if (recurring) { this.features.shuffle = true }

    }

    stop(force = false) {

        if (this.activePlayer?.current !== 'music') { 
            this.switchPlayer('music')
        }

        this.state = 'stopping'
        this.songs.upcoming = []
        this.songs.previous = []
        this.songs.current = null
        this.clearLyrics()

        if (!force) {
            this.fade('out'); this.inTransition = true
            let checkInt = setInterval(() => { if (!this.inTransition) { clearInterval(checkInt); this.players?.music?.player?.stop() } }, 50)
        }

        else { this.players?.music?.player?.stop() }

        this.update()

    }

    loop(type = 0) {

        if (type === 0) { if (this.loops.currentSong) { this.loops.currentSong = false } else { this.loops.currentSong = true } }
        else { if (this.loops.entireQueue) { this.loops.entireQueue = false } else { this.loops.entireQueue = true } }

    }

    skip(force = false, back = false) {

        if (this.songs.current.meta.suggested && this.players.music?.currentResource?.playbackDuration < 7500) { this.songs.current.meta.ignoreSuggested = true }

        if (this.players.music?.currentResource?.playbackDuration < 7500) { try { this.songs.current.delete() } catch { } }

        if (back) { 

            this.songs.upcoming.insert(0, this.songs.previous.pop() || this.songs.current)
            this.update()

            this.skip()

        }

        if (this.songs.upcoming[0]) { this.events.emit('SongFinished') } 
        else { this.players.music.player.stop() }

    }

    async fade() {

        this.inTransition = true
        let volumeAmt = -0.1;
        let volume = this.volume
        this.oldVol = volume

        for (let i = volume; i <= 1 && i >= 0; i += volumeAmt) {

            await sleep(100);

            let volFloat = parseFloat(volume)
            volume = parseFloat(volFloat += volumeAmt).toFixed(1)
            if (volume > 1 || volume <= 0) { break }

            this.players.music.currentResource.volume.setVolume(parseFloat(volume))
        }

        this.players.music.currentResource.volume.setVolume(0)
        this.volume = 0

        this.update()
        this.inTransition = false

    }

    getPlayButtons(song) {

        const ui = process.meta.config.ui.playUI

        if (this.songs?.current?._internalId === song._internalId) {

            let pauseId = process.meta.config.botSettings.buttons.main.pause
            if (this.state === 'paused') { pauseId = process.meta.config.botSettings.buttons.main.play }

            let modeId = process.meta.config.botSettings.buttons.switchMode.normal
            if (this.modes.spatial) modeId = process.meta.config.botSettings.buttons.switchMode.spatial
            if (this.modes.dynamic) modeId = process.meta.config.botSettings.buttons.switchMode.dynamic

            let row1 = new ActionRowBuilder()
                .addComponents(new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(process.meta.config.botSettings.buttons.last)
                    .setCustomId('last'))
                .addComponents(new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(ui.seek_backward)
                    .setCustomId('seek.backward'))
                .addComponents(new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(pauseId)
                    .setCustomId('play-pause'))
                .addComponents(new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(ui.seek_forward)
                    .setCustomId('seek.forward'))
                .addComponents(new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(process.meta.config.botSettings.buttons.next)
                    .setCustomId('next'))
            
            let row2 = new ActionRowBuilder()
                .addComponents(new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(process.meta.config.botSettings.buttons.lyrics)
                    .setCustomId('lyrics'))
                .addComponents(new ButtonBuilder()
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(ui.modes.normal)
                        .setCustomId('mode'))
                .addComponents(new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(ui.stop)
                    .setCustomId('stop'))
                .addComponents(new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(ui.loop)
                    .setCustomId('loop'))
                .addComponents(new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(process.meta.config.botSettings.buttons.save)
                    .setCustomId('save'))

            return [row1, row2]
        }

        else {

            let row1 = new ActionRowBuilder()
                .addComponents(new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('1024086708490346597')
                    .setCustomId('remove'))
                .addComponents(new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(process.meta.config.botSettings.buttons.save)
                    .setCustomId('save'))
                .addComponents(new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(process.meta.config.botSettings.buttons.queue)
                    .setCustomId('queue'))
                .addComponents(new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(process.meta.config.botSettings.buttons.info)
                    .setCustomId('info'))
                .addComponents(new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(process.meta.config.botSettings.buttons.skipTo)
                    .setCustomId('skipto'))

            return [row1]

        }

    }

    async routeVoiceCommands(transcription, requester) {

        let prefixes = [ 'music', 'ducky' ]
        let segments = transcription.split(' ')
        if (!prefixes.includes(segments[0])) { return }

        if (segments[1] === 'auto') { segments[1] = `${segments[1]}${segments[2]}`; segments.splice(2, 1) }

        let command = segments[1]
        let args = (segments.splice(2)).join(' ')

        const file = process.meta.voiceCommands.get(command)
        if (!file || !file?.execute_voice) {
            
            try { this.speak("That's not a valid command. To view all available voice interactions, say music help.") } catch { }
            return 
        }
    
        try {
            log('Voice Command Use', `${requester.username} used [${file?.command?.voiceName || file?.command?.name}]`)
            await file.execute_voice(args, this, requester)
        }

        catch (error) {
            log('Voice Command Error', error)
        }
    
    }

    handleStdButtonIds(message, song) {

        Array.prototype.insert = function (index, item) { this.splice(index, 0, item) }

        let collector = message.createMessageComponentCollector({ time: 3600000 })

        collector.on('collect', async (childInt) => {

            let id = childInt.customId
            await childInt.deferUpdate().catch((err) => { log('Button Defer Error', err) })

            if (!this.songs.current && ![ 'autoplay', 'disconnect', 'forget', 'save', 'queue', 'last' ].includes(id)) {
                return childInt.followUp({ embeds: [WarningEmbed("Ducky is not currently playing anything.", `To use playback buttons, please play a song first.`)], components: [], ephemeral: true }).catch(() => { })
            }

            if (!childInt.member?.voice?.channel && ![ 'save', 'queue' ].includes(id)) {
                return childInt.followUp({ embeds: [WarningEmbed("You must be in a voice channel to use this command.", `To use playback buttons, please join a voice channel.`)], components: [], ephemeral: true }).catch(() => { })
             }

            if (id === 'next') {

                if (this.songs.upcoming[0]) this.skip(true) // skips transitions due to loading times
                else this.skip()

            }

            else if (id === 'last') {

                if (!this.songs.previous[0]) {
                    return childInt.followUp({ embeds: [WarningEmbed("There are no previous songs to skip to.", `Please play a song and allow it to finish first.`)], components: [], ephemeral: true }).catch(() => { })
                }

                this.songs.upcoming.insert(0, this.songs.previous.pop() || this.songs.current)
                this.update()

                if (this.state === 'playing') this.skip(true) // skips transitions due to loading times
                else this.skip()

            }

            else if (id === 'loop') {

                // This method should only be used on a now playing / queue interface 

                if (this.loops.currentSong) {

                    this.loops.currentSong = false
                    this.loops.entireQueue = true
                    childInt.message.edit({ embeds: [song?.getEmbed()] || childInt.message.embeds, components: this.getPlayButtons(song) })


                }

                else if (this.loops.entireQueue) {

                    this.loops.currentSong = false
                    this.loops.entireQueue = false
                    childInt.message.edit({ embeds: [song?.getEmbed()] || childInt.message.embeds, components: this.getPlayButtons(song) })


                }

                else {

                    this.loops.currentSong = true
                    childInt.message.edit({ embeds: [song?.getEmbed()] || childInt.message.embeds, components: this.getPlayButtons(song) }).catch((err) => { })

                }

            }

            else if (id === 'play-pause') {

                if (this.state === 'paused') { this.resume() }
                else if (this.state === 'playing') { this.pause() }
                
                childInt.message.edit({ embeds: childInt.message.embeds, components: this.getPlayButtons(song) }).catch((err) => { })

            }

            else if (id === 'disconnect') {

                childInt.followUp({ embeds: [CreateEmbed('Voice Session Ended', `Disconnected from ${this.voiceChannel?.name || 'your call'}.\nAny settings changed have been saved.`, `${childInt.user.username} Disconnected Ducky`, childInt.member)] }).catch((err) => { log('Interaction Error', err) })

                try { this.disconnect() } catch (err) {
                    log('Disconnect Error', err)
                    childInt.followUp({ embeds: [ErrorEmbed("Ducky could not leave your call.", `Something prevented Ducky from leaving your call.\nPlease forcefully disconnect Ducky if this continues.`)], components: [], ephemeral: true })
                    return
                }
                this.destroy().catch((err) => { log('Queue Recycling Error', err) })

            }

            else if (id === 'forget') {

                try { this.disconnect() } catch (err) { /* Throwing away this error here */ }
                this.destroy(true).catch((err) => { log('Queue Recycling Error', err) })

                await childInt.channel.send({ embeds: [CreateEmbed('Reset this server\'s queue.', `Disconnected from ${this.voiceChannel?.name || 'your call'}.\nAny upcoming songs queued or settings changed **have been deleted**.`, `${childInt.user.username} Reset The Queue`, childInt.member)] }).catch((err) => { log('Interaction Error', err) })

            }

            else if (id === 'ff') {

                let user = await getUser(childInt.member.user.id, process.meta.client)
                const { isActive, expiry } = await user.checkCooldown('button-ff')

                if (isActive) { return childInt.followUp({ embeds: [WarningEmbed('You are being time restricted from this action.', `You can use this button again starting at <t:${expiry}:T>`)], ephemeral: true }) }

                user.addCooldown('button-ff', 5)

                if (!this.songs.current) { return false }

                let seekTime = parseInt((this.players.music.currentResource.playbackDuration / 1000)?.toFixed()) + 15
                if (seekTime > this.songs.current.durationInSec) {
                    if (this.songs.upcoming[0]) this.skip(true) // skips transitions due to loading times
                    else this.skip()
                    return
                }
                if (seekTime < 1) {
                    seekTime = 0
                }

                this.songs.current.ffmpeg(seekTime).catch((err) => {

                    log('Seek Error', err)
                    childInt.followUp({ embeds: [ErrorEmbed("This song could not be seeked.", `This may be due to the format being unsupported.\nSeeking is unavailable when playing via Ducky's external media extractor.`)], components: [], ephemeral: true }).catch(() => { })

                })

            }

            else if (id === 'stop') {

                this.stop()
                await childInt.channel.send({ embeds: [CreateEmbed('Stopped this server\'s queue.', `The current, previous and all upcoming songs have been cleared.\nAny other settings changed **have been saved**.`, `${childInt.user.username} Stopped The Queue`, childInt.member)] }).catch((err) => { log('Interaction Error', err) })

            }

            else if (id === 'save') {

                let user = await getUser(childInt.user.id, process.meta.client)
                let selected = 0; let maxValue = 5; let minValue = 0

                function getDisplay(maxValue = 5, minValue = 0, selected = null) {

                    const playlists = (user.library?.playlists || new Array())
                    const combinedDescription = new Array()

                    let likedSelected = ''
                    if (selected === 0) { likedSelected = '> ' }
                    
                    combinedDescription.push(`${likedSelected} **Liked Songs** • Created by ${childInt.user.username || "unknown"}, ${user.library.songs?.length} ${wordChoice(user.library.songs?.length, 'song')}\nThis is a default playlist managed by Ducky.\n`)

                    for (let i = minValue + 1; i < maxValue; i += 1) {
        
                        let prefix = ''
                        if (i === selected) { prefix = '> ' }
                        if (playlists[i - 1]) {
                            combinedDescription.push(`${prefix} [${playlists[i - 1].name}](${playlists[i - 1].url}) • Created by ${playlists[i - 1].creator || "unknown"}, ${playlists[i - 1].songs?.length} ${wordChoice(playlists[i - 1].songs?.length, 'song')}\n${limit(playlists[i - 1].description, 45) || 'No description provided.'}\n`)
                        }
                   
                    }
            
                    return combinedDescription.join('\n')
            
                }
            
                function getButtons(max, selected) {

                    let changed = false
                    if (!selected) { selected = 0; changed = true }
                    
                    let selectDisabled = true; let downDisabled = true; let upDisabled = true;
                    let addDisabled = true;
                    let pageBackDisabled = true; let nextPageDisabled = true
                                            
                    if (user.library?.playlists[max + 1]) { nextPageDisabled = false }
                    if (user.library?.playlists[max - 6]) { pageBackDisabled = false }
                
                    if (selected >= 0) { addDisabled = false; selectDisabled = false }
                
                    if (selected <= user.library?.playlists?.length - 1) { downDisabled = false }
                    if (selected >= 1) { upDisabled = false; addDisabled = false }
                    
                    if (changed) { selected = null }

                    let row1 = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.down).setCustomId('down').setDisabled(downDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.select).setCustomId('select').setDisabled(selectDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.up).setCustomId('up').setDisabled(upDisabled))
                    let row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji('1042216548028395590').setCustomId('last-page').setDisabled(pageBackDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.addToQueue).setCustomId('add').setDisabled(addDisabled)).addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.nextPage).setCustomId('next-page').setDisabled(nextPageDisabled))
                    return [row1, row2]
                    
                }

                user.library.songs.push(new writeableSong(song))
                await user.save()

                let initEmbed = CreateEmbed('Added this song to your liked songs.', `You now have ${user.library.songs.length} liked ${wordChoice(user.library.songs.length, 'song')}.\nUse the <:add:${process.meta.config.botSettings.buttons.addToQueue}> button to add this song to a playlist instead.`, `${childInt.user.username}'s Library`, childInt.member, null, null, 'Use /library to view all your liked songs.', null, { thumbnail: childInt.member.user.avatarURL() })

                const saveButton = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(process.meta.config.botSettings.buttons.addToQueue).setCustomId('add-playlist'))
                childInt.followUp({ embeds: [initEmbed], components: [saveButton], ephemeral: true }).then((msg) => {
                    
                    let collector = msg.createMessageComponentCollector({ time: 3600000 })

                    collector.on('collect', async (newChildInt) => {

                        await newChildInt.deferUpdate().catch((err) => { })

                        user.library.songs.splice(user.library.songs.indexOf(new writeableSong(song)), 1)
                        await user.save()

                        newChildInt.deleteReply()
                                    
                        let embed = CreateEmbed('Select Where To Save', getDisplay(maxValue, minValue, selected), `${newChildInt.user.username}'s Library`, newChildInt.member, null, null, null, null, { thumbnail: newChildInt.member.user.avatarURL() })

                        newChildInt.followUp({ embeds: [embed], components: getButtons(maxValue, selected), ephemeral: true }).then((msg) => { handleSelectButton(msg) }).catch((err) => { log('Interaction Reply Error', err) })

                    })

                }).catch((err) => { log('Interaction Reply Error', err) })


                function handleSelectButton(msg) {

                    let collector = msg.createMessageComponentCollector({ time: 3600000 })

                    collector.on('collect', async (childInt) => {
            
                        let id = childInt.customId
                                    
                        if (id === 'down') {
                            
                            selected = selected + 1
                            if (selected > maxValue) { maxValue = maxValue + 5; minValue = maxValue - 5 }
                            
                            let embed = CreateEmbed('Select Where To Save', getDisplay(maxValue, minValue, selected), `${childInt.user.username}'s Library`, childInt.member, null, null, null, null, { thumbnail: childInt.member.user.avatarURL() })

                            childInt.update({ embeds: [embed], components: getButtons(maxValue, selected), ephemeral: true }).then((msg) => { }).catch((err) => { log('Interaction Reply Error', err) })
            
                        }
            
                        else if (id === 'up') {
                            
                            selected = selected - 1
                            if (selected < minValue) { minValue = minValue - 5; maxValue = minValue + 5 }
                            
                            let embed = CreateEmbed('Select Where To Save', getDisplay(maxValue, minValue, selected), `${childInt.user.username}'s Library`, childInt.member, null, null, null, null, { thumbnail: childInt.member.user.avatarURL() })

                            childInt.update({ embeds: [embed], components: getButtons(maxValue, selected), ephemeral: true }).then((msg) => { }).catch((err) => { log('Interaction Reply Error', err) })
            
                        }
            
                        else if (id === 'last-page') {
                            
                            minValue = minValue - 5; maxValue = minValue + 5
                            selected = maxValue
                            
                            let embed = CreateEmbed('Select Where To Save', getDisplay(maxValue, minValue, selected), `${childInt.user.username}'s Library`, childInt.member, null, null, null, null, { thumbnail: childInt.member.user.avatarURL() })

                            childInt.update({ embeds: [embed], components: getButtons(maxValue, selected), ephemeral: true }).then((msg) => { }).catch((err) => { log('Interaction Reply Error', err) })
            
                        }
            
                        else if (id === 'next-page') {
            
                            maxValue = maxValue + 5; minValue = maxValue - 5
                            selected = minValue
                            
                            let embed = CreateEmbed('Select Where To Save', getDisplay(maxValue, minValue, selected), `${childInt.user.username}'s Library`, childInt.member, null, null, null, null, { thumbnail: childInt.member.user.avatarURL() })

                            childInt.update({ embeds: [embed], components: getButtons(maxValue, selected), ephemeral: true }).then((msg) => { }).catch((err) => { log('Interaction Reply Error', err) })
            
                        }
            
                        else if (id === 'add') {

                            const modal = new ModalBuilder().setCustomId('namePlaylist').setTitle('Create A New Playlist')
        
                            const nameInput = new TextInputBuilder().setCustomId('name').setLabel("Enter a name for this playlist.").setStyle(TextInputStyle.Short).setRequired(true).setMinLength(2).setMaxLength(35);
                            const descriptionInput = new TextInputBuilder().setCustomId('description').setLabel("Enter a description for this playlist.").setStyle(TextInputStyle.Short).setMinLength(5).setMaxLength(150).setRequired(false);
        
                            const actionRow = new ActionRowBuilder().addComponents(nameInput)
                            const nextRow = new ActionRowBuilder().addComponents(descriptionInput)
                            modal.addComponents(actionRow, nextRow)
        
                            childInt.showModal(modal)
        
                            childInt.awaitModalSubmit({ time: 300000 })
                                
                                .then(async (modalInt) => {
        
                                    const name = modalInt.fields.getTextInputValue('name')
                                    const description = modalInt.fields.getTextInputValue('description')
        
                                    const resolvedPlaylist = new playlist(null, modalInt.user.username, { name: name, description: description })
                                
                                    user.addResolvedPlaylist(resolvedPlaylist)
                                
                                    let embed = CreateEmbed('Select Where To Save', getDisplay(maxValue, minValue, selected), `${childInt.user.username}'s Library`, childInt.member, null, null, null, null, { thumbnail: childInt.member.user.avatarURL() })

                                    modalInt.update({ embeds: [embed], components: getButtons(maxValue, selected), ephemeral: true }).then((msg) => { }).catch((err) => { log('Interaction Reply Error', err) })
        
                                }).catch((err) => { (log('Modal Error', err)) })
        
                        }

                        else if (id === 'select') {
            
                            await childInt.deferUpdate().catch((err) => { log('Button Defer Error', err) })

                            if (selected === 0) { user.library.songs.push(new writeableSong(song)) }
                            else { user.library.playlists[selected - 1].songs.push(new writeableSong(song)) }
                            user.save()

                            childInt.deleteReply()
                            
                            if (selected === 0) { childInt.followUp({ embeds: [CreateEmbed('Added this song to your liked songs.', `You now have ${user.library.songs.length} liked ${wordChoice(user.library.songs.length, 'song')}.\nUse \`/library\` for complete control over your liked songs and playlists.`, `${childInt.user.username}'s Library`, childInt.member)], ephemeral: true }).catch((err) => { log('Interaction Error', err) }) }
                            else { childInt.followUp({ embeds: [CreateEmbed(`Added this song to "${user.library.playlists[selected - 1].name}"`, `You now have ${user.library.playlists[selected - 1].songs.length} ${wordChoice(user.library.playlists[selected - 1].songs.length, 'song')} in this playlist.\nUse \`/library\` for complete control over your playlists and liked songs.`, `${childInt.user.username}'s Library`, childInt.member)], ephemeral: true }).catch((err) => { log('Interaction Error', err) }) }
                            
                        }

                    })

                }

            }
    
            else if (id === 'queue') {

                function onlyUnique(value, index, self) {
                    return self.indexOf(value) === index;
                }

                function getEmbed(minValue = 0, maxValue = 5, selected = null, queue) {

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

                    const embed = CreateEmbed(`${queue.textChannel.guild.name}'s Queue`,
                        `${queue.songs.upcoming.length + 1} active ${wordChoice(queue.songs.upcoming.length + 1, 'song')} • ${formatDur((combinedLength).toFixed())} min until finished • ${allArtists.length} unique ${wordChoice(allArtists.length, 'artist')}\n${dynamicDescription}`,
                        `${queue.songs.current.timeLeft()} min until the ${operand}.`, null, null,
                        [
                            { name: 'Current', value: `${currentDisplay}`, inline: false }, // possibly add progress bar 
                            { name: 'Previous', value: `${previousDisplay.join('\n')}`, inline: true },
                            { name: 'Upcoming', value: `${upcomingDisplay.join('\n')}`, inline: true },
                        ],
                        'Use /queue to control all upcoming songs.', null, { url: queue.url || queue.songs.current.urls.duckyURL }
                    )

                    return embed

                }

                await childInt.followUp({ embeds: [getEmbed(0, 5, null, this)], ephemeral: true }).catch((err) => { log('Interaction Error', err) })

            }

            else if (id === 'switchmode') {

                if (this.songs.current.type === 'arbitrary') { return childInt.followUp({ embeds: [WarningEmbed("Enhanced mode is currently unavailable.", `This mode is unavailable on songs from outside/unknown sources.`)], components: [], ephemeral: true }).catch(() => { }) }
        
                let user = await getUser(childInt.user.id, process.meta.client)
                const { isActive, expiry } = await user.checkCooldown('button-switchmode')

                if (isActive) { return childInt.followUp({ embeds: [WarningEmbed('You are being time restricted from this action.', `You can use this button again starting at <t:${expiry}:T>`)], ephemeral: true }) }

                user.addCooldown('button-switchmode', 10)

                this.switchMode()
                childInt.message.edit({ embeds: [song.getEmbed()], components: this.getPlayButtons(song) })

                if (user.checkCTA('modes')) { 

                    childInt.followUp({ embeds: [ user.getCTA('modes') ], ephemeral: true }).catch((err) => { log("CTA Error", err) })
            
                }

            }

            else if (id === 'lyrics') {

                if (!this.songs?.current?.ids?.spID) { return await childInt.followUp({ embeds: [ErrorEmbed(`Time-Synced Lyrics aren't offered for this track, yet.`, `Automated Lyrics will be available for all tracks, coming soon.`)], ephemeral: true }).catch((err) => { log('Interaction Error', err) }) }
                if (this.lyrics.lyricsInProgress) { return await childInt.followUp({ embeds: [WarningEmbed(`Flowing or Interactive Lyrics are already being used for this song.`, `To preserve performance, Ducky only serves one lyric request per song.\nIf a lyric message was recently deleted, wait until the next verse to try again.`)], ephemeral: true }).catch((err) => { log('Interaction Error', err) }) }

                let message = await childInt.followUp({ embeds: [CreateEmbed(`<:instrumental:${process.meta.config.botSettings.buttons.instrumentalPlaceholder}>`, null, 'Flowing Lyrics', null, '1cfaa4', null, 'Provided By Spotify', true)] })

                try { await this.songs.current.startSyncedLyrics(message) }
                catch (err) {
                    log('Lyric Error', err)
                    return await message.edit({ embeds: [ErrorEmbed('We found time-synced lyrics, but can\'t process them.', `Something prevented Ducky from processing neccessary lyric data.\nPlease [contact support](${process.meta.config.misc.links.support}) if this error continues.`)] }).catch((err) => { log('Interaction Error', err) })
                }

                let user = await getUser(childInt.user.id, process.meta.client)

                if (user.checkCTA('flyrics')) { 

                    childInt.followUp({ embeds: [ user.getCTA('flyrics') ], ephemeral: true }).catch((err) => { log("CTA Error", err) })
            
                }
                
            }
        
            else if (id === 'info') { 

                let resolvedSong = song 
                
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
                    `Extended Info`, childInt.member, null,
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

            else if (id === 'skipto') { 

                let selected = this.songs.upcoming[this.songs.upcoming.indexOf(song)]
                if (selected < 1) { 
                    return childInt.followUp({ embeds: [ WarningEmbed('This song is no longer in the queue.', 'This song cannot be found in the queue\'s current upcoming songs.')], ephemeral: true }).catch((err) => { })
                 }

                let removedSongs = this.songs.upcoming.splice(0, this.songs.upcoming.indexOf(selected))
                let reversedRemoved = removedSongs.reverse()
                this.songs.previous.push(...reversedRemoved)

                this?.players?.music?.player.stop()

            }

            else if (id === 'remove') { 

                let selected = this.songs.upcoming[this.songs.upcoming.indexOf(song)]
                if (selected < 1) { 
                    return childInt.followUp({ embeds: [ WarningEmbed('This song is no longer in the queue.', 'This song cannot be found in the queue\'s current upcoming songs.')], ephemeral: true }).catch((err) => { })
                 }

                let removedSong = this.songs.upcoming.splice(selected, 1)
                this.songs.previous.push(...removedSong)

                let playEmbed = childInt.message.embeds[0]
                playEmbed.data.description = 'This song has been removed from the upcoming queue.'
                childInt.message.edit({ embeds: [playEmbed], components: [] }).catch((err) => { })
            }

            else if (id === 'autoplay') { 

                const { enabled } = this.setAutoplay()

                if (!enabled) { return childInt.followUp({ embeds: [ CreateEmbed('AutoPlay is now disabled.', 'Suggested songs will no longer be appended to the upcoming queue.', 'Settings Changed', childInt.member) ], ephemeral: true }).catch((err) => { })}

                if (enabled) { 

                    if (!this.songs.previous[0]) { return childInt.followUp( { embeds: [ ErrorEmbed('There are no previous songs.', 'At least one song must be in the previous queue to enable autoplay.')], ephemeral: true } ).catch((err) => { })}

                    let suggestedSong = await this.songs.previous[0].getSuggestedSong().catch((err) => {
                        log('Suggested Song Search Error', err)
                        return this.textChannel.send({ embeds: [WarningEmbed('No more suggested songs could be found.', err.message)], components: [] }).then((msg) => { }).catch()
                    })
                    if (!suggestedSong) { 
                        return 
                    }
    
                    if (this.songs.current) this.songs.previous.push(this.songs.current)
                    this.songs.current = null
    
                    this.songs.current = suggestedSong
                    this.update()
    
                    this.textChannel.send({ embeds: [this.songs.current.getEmbed(false, 'np')], components: this.getPlayButtons(this.songs.current) }).then((msg) => { if (msg) this.handleStdButtonIds(msg, this.songs.current) }).catch()
        
                    this.play()

                }

            }

        })

    }

    display(minDepth = 0, maxDepth = 5, selected = null) {

        let parRegex = / *\([^)]*\) */g; let barRegex = / *\[[^)]*\] */g

        const descriptionFields = { previousDisplay: new Array(), currentDisplay: null, upcomingDisplay: new Array() }

        for (let i = minDepth; i < maxDepth; i += 1) {

            if (this.songs.previous[i]) descriptionFields.previousDisplay.push(`[${this.songs.previous[i]?.titles.display.normal?.replace(barRegex, '')?.replace(parRegex, '')}](${this.songs.previous[i]?.urls.duckyURL})`)

        }

        descriptionFields.currentDisplay = `[${this.songs.current.titles.display.normal}](${this.songs.current?.urls.duckyURL}) • ${this.songs.current?.artists[0]}${this.songs.current?.releasedYear ? `, ${this.songs.current?.releasedYear}` : ''}`

        for (let i = minDepth; i < maxDepth; i += 1) {

            let prefix = ''
            if (i === selected - 1) { prefix = '> ' }
            if (this.songs.upcoming[i]) descriptionFields.upcomingDisplay.push(`${prefix}[${this.songs.upcoming[i]?.titles.display.normal?.replace(barRegex, '')?.replace(parRegex, '')}](${this.songs.upcoming[i]?.urls.duckyURL}) • ${this.songs.upcoming[i]?.artists[0]}${this.songs.upcoming[i]?.releasedYear ? `, ${this.songs.upcoming[i]?.releasedYear}` : ''}`)

        }

        if (descriptionFields.previousDisplay.length < 1) { descriptionFields.previousDisplay.push('No previous songs.') }
        if (descriptionFields.upcomingDisplay.length < 1) { descriptionFields.upcomingDisplay.push('No upcoming songs.') }
        if (!descriptionFields.currentDisplay) { descriptionFields.currentDisplay = 'There is no song currently playing in this server\'s queue.' }

        return descriptionFields

    }

}

export class writableQueue {

    constructor(initializedQueue) {

        let writableUpcoming = []
        let writablePrevious = []
        let currentWritable;

        for (const song of initializedQueue?.songs?.upcoming) { writableUpcoming.push(new writeableSong(song)) }
        for (const song of initializedQueue?.songs?.previous) { writablePrevious.push(new writeableSong(song)) }
        if (initializedQueue.songs.current) { currentWritable = new writeableSong(initializedQueue.songs.current) }


        this.parent = initializedQueue.parent
        this.voiceChannelID = initializedQueue.voiceChannel?.id
        this.modes = initializedQueue.modes
        this.boundTextChannelID = initializedQueue.textChannel.id
        this.songs = { current: currentWritable || null, upcoming: writableUpcoming, previous: writablePrevious }
        this.state = initializedQueue.state
        this.volume = initializedQueue.volume
        this.loops = initializedQueue.loops
        this.effects = initializedQueue.effects
        this.features = initializedQueue.features
        this.firstCreated = initializedQueue.firstCreated

    }

    async createEntry() {

        createDBEntry(this, 'queues')

    }

    async updateEntry() {

        if (process.meta.config.misc.saveQueues) { overwriteDBEntry(this, 'queues') }

    }

}

function getNewInternalID() { 

    const allCreatedIDs = JSON.parse(fs.readFileSync('./resources/idPool.json'))

    const createKey = customAlphabet('1234567890', 18)

    let newID = createKey()

    while (allCreatedIDs.includes(newID)) { newID = createKey() }
    
    allCreatedIDs.push(newID)

    if (process.meta.config.misc.cacheSongs) { fs.writeFileSync('./resources/idPool.json', JSON.stringify(allCreatedIDs)) }

    return newID

}