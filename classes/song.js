'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { createDBEntry, updateDBEntry, findCachedSong } from '../functions/data.js'
import { createAudioResource, StreamType, demuxProbe } from '@discordjs/voice'
import { checkSpToken, convertSpToYt } from '../functions/sources.js'
import { WarningEmbed } from '../functions/interface.js'
import { log, wordChoice, limit } from '../functions/misc.js'
import Spotify from 'spotify-web-api-node'
import { EmbedBuilder } from 'discord.js'
import { customAlphabet } from 'nanoid'
import ytdlCore from 'discord-ytdl-core'
import Str from '@supercharge/strings' 
import { exec } from 'child_process'
import { pipeline } from 'stream'
import { DateTime } from 'luxon'
import prism from 'prism-media'
import fetch from 'node-fetch'
import playDL from 'play-dl'
import util from 'util'
import fs from 'fs'

const songTypes = { 

    ARBITRARY: "arbitrary",
    CACHED: "existing",
    NORMAL: "full",
    PARTIAL: "partial"
}

export async function checkCache(search, requester, channel) { 

    let cachedSong = await findCachedSong(search)
    if (!cachedSong) { return false }
    let newSong = new song(cachedSong, requester, channel, search)
    return newSong

}

export function getSong(search, requester, channel, playlistDetails = { url: null, part: false, name: null, len: 503, duration: 817 }, data = { youtube: null, soundcloud: null, spotify: null, raw: null, custom: null }, message) { 

    let newSong = new song(data.custom, requester, channel, search, playlistDetails, data.youtube, data.spotify, data.soundcloud, data.raw, message)
    // if (newSong.error) { throw new Error(newSong.error) }

    let searchURL;
    try { searchURL = new URL(search) } catch { }
    if (searchURL) { search = null }

    if (process.meta.config.misc.cacheSongs && newSong.type !== 'arbitrary' && search) { newSong.create() }
    return newSong

}

export class song {

    constructor(existingSong = undefined, requester = false, channel = false, search = 'No original search', playlist = { url: null, part: false, name: null, len: 503, duration: 817 }, ytResult = undefined, spResult = false, scResult = false, raw = false, message = null) {

        if (existingSong) { this.type = 'existing' }
        else if (ytResult && !spResult && !scResult) { this.type = 'partial' }
        else if (ytResult && (spResult || scResult)) { this.type = 'full' }
        else if ((!ytResult && !spResult) && scResult) { this.type = 'backup' }
        else if (raw) { this.type = 'arbitrary' }

        this.metaType = null

        if (existingSong) {

            if (existingSong.sources.yt) { this.metaType = songTypes.PARTIAL }
            if (existingSong.sources.sp) { this.metaType = songTypes.FULL }

        }

        if (ytResult) { this.metaType = songTypes.PARTIAL }
        if (spResult) { this.metaType = songTypes.FULL }

        if (raw) { this.metaType = songTypes.ARBITRARY }

        if (!ytResult && !scResult && !raw && !existingSong?.sources?.yt && !existingSong?.sources?.sc) { this.type = 'unresolved' }

        this._internalId = 'i' + this.getNewInternalID()
        
        this.toBeCached = false
        if (process.meta.config.misc.cacheSongs && (ytResult || scResult)) { this.toBeCached = true }

        this.linkedChannel = channel

        this.parentQueue = process.meta.queues.get(channel?.guild?.id)
        this.ids = existingSong?.ids || { duckyID: this.getNewInternalID(), ytID: ytResult?.id, spID: spResult?.id, scID: scResult?.id, rawID: raw?.id }
        this.urls = existingSong?.urls || { duckyURL: `${process.meta.config.misc.apiDomain}/songs?id=${this.ids.duckyID}`, ytURL: ytResult?.url, spURL: spResult?.url, scURL: scResult?.permalink || scResult?.url, rawURL: raw?.url }
        this.explicit = existingSong?.explicit || spResult?.explicit

        let ytTitle = !ytResult?.dontinfer ? parseMusic(ytResult, search)?.song : ytResult?.title 
        this.titles = existingSong?.titles || { display: { normal: existingSong?.titleNorm || spResult?.name || scResult?.name || ytTitle || raw?.title || 'Title Not Available', }, youtube: ytResult?.title || null, spotify: spResult?.name || null, soundcloud: scResult?.name || null, raw: raw?.title }
        this.titles.display.lower = this.titles.display.normal.toLowerCase()
        this.artists = existingSong?.artists || []

        if (raw && raw?.artist) { this.artists.push(raw?.artist) }

        if (this.artists.length < 1 && parseMusic(ytResult, search)) { 

            let result = parseMusic(ytResult, search)
            if (result.artist) {
                this.artists = []
                this.artists.push(result.artist) 
            }

        }
        
        if (this.artists.length < 1 && (ytResult?.channel?.artist || ytResult?.channel?.name)) { this.artists = [ ytResult?.channel?.name ] }

        if (spResult) { this.artists = []; for (const artist of spResult.artists || []) { this.artists.push(artist.name) } }
        if (scResult && !spResult) {

            this.artists = []
            if (scResult.publisher) { this.artists.push(scResult?.publisher?.artist) }
            else { this.artists.push(scResult?.user?.name) }

        }

        if (this.artists.length < 1 && raw) { this.artists.push(raw?.artist || raw?.sourceSite) }
        if (this.artists.length < 1) { this.artists.push('3rd Party Publisher') }
        
        this.requester = requester
        this.coverArt = existingSong?.coverArt || spResult?.thumbnail?.url || spResult?.album?.images[0]?.url || ytResult?.thumbnails[0]?.url|| scResult?.thumbnail || raw?.thumbnail || process.meta.config.botSettings.defaultCover
        this.duration = existingSong?.duration || { sec: ytResult?.durationInSec || scResult?.durationInSec || spResult?.durationInSec || raw.duration || 817, ms: ytResult?.durationInSec * 1000 || spResult?.durationInMs || scResult?.durationInMs || raw.durationInMs || 817000, formatted: null }
        this.duration.formatted = formatDur(this.duration.sec)
        this.views = existingSong?.popularity || ytResult?.views // BREAKING: CHANGED FROM <Song>#popularity in < 0.3
        this.album = existingSong?.album || spResult?.album?.name || this.titles.display.normal // Experimental
        this.releasedYear = null
        this.releaseDate = existingSong?.releaseDate || spResult?.album?.release_date // Experimental

        this.sources = existingSong?.sources || { yt: ytResult, sp: spResult, sc: scResult, raw: raw }

        this.cached = { message: message, lyrics: null, ytInfo: null, audioResource: null /* small type change */ }
        this.info = null
        this.meta = { search: search?.toLowerCase(), voice: false, suggested: false, ignoreSuggested: false, playlist: { partOfPlaylist: playlist?.part, url: playlist?.url, name: playlist?.name, len: playlist?.len, duration: playlist?.duration }, raw: { fromDomain: raw?.domain || 'Unknown Source', fromID: null } }
        this.inSeek = false 
        this.writable = false 

        if (this.sources?.sp?.album?.release_date || this.sources?.yt?.uploadedAt?.includes('-')) {

            let parsed = DateTime.fromISO(this.sources?.sp?.album?.release_date || this.sources?.yt?.uploadedAt)
            this.releasedYear = parsed.toFormat('yyyy')

         }

    }

    async create() { 

        const songToWrite = new writeableSong(this)
        let result = await songToWrite.createEntry()
        if (!result) { return false } else return true

    }

    async update(key, value) { 
        
        const songToWrite = new writeableSong(this)
        let result = await songToWrite.updateEntry(key, value)
        if (!result) { return false } else return true

    }

    delete() { 
        
        if (fs.existsSync(`./data/songs/${this.ids.duckyID}.json`)) { 

            fs.unlinkSync(`./data/songs/${this.ids.duckyID}.json`) 
            return true 

        }

        else { return false }
        
    }


    timeLeft() { 

        const currentDurationsec = (this.parentQueue.players.music.currentResource.playbackDuration / 1000).toFixed()

        let strTimeLeft = formatDur(this.duration.sec - currentDurationsec)

        return strTimeLeft || '4:20'

    }

    async getAudioResource() {

        let resource, stream = new Object()

        if (this.type === 'arbitrary') {
            try {
                if (this.sources.raw.file) {

                    stream.stream = ytdlCore.arbitraryStream(this.urls.rawURL, { filter: 'audioonly' })
                    stream.type = StreamType.Raw

                }
               
                else {
                    await util.promisify(exec)(`yt-dlp -x ${this.urls?.rawURL} -o '../../data/temp/${this._internalId}.%(ext)s'`, { cwd: './resources/assets' })
            
                    let file = fs.readdirSync('./data/temp').filter(file => file.includes(this._internalId))[0]
                    stream = await demuxProbe(fs.createReadStream(`./data/temp/${file}`))

                }

            } catch (err) { log('Arbitrary Stream Error', err); throw new Error('The link to this song cannot be resolved to a media stream.\nThis can be due to an invalid URL or incompatable site.') }
        }
        
        if (this.urls.scURL) {
            stream = await playDL.stream(this.urls.scURL).catch((err) => {
                log("Play-DL Stream Error", err)
            })
        }

        else if (this.urls.ytURL) {

            let ytInfo = await playDL.video_info(this.urls.ytURL).catch((err) => { log("Play-DL Video Query Error", err)})
            stream = await playDL.stream_from_info(ytInfo).catch((err) => {
                log("Play-DL Stream Error", err)
            })

            this.cached.ytInfo = ytInfo

        }

        if (!stream) { throw new Error('The link to this song cannot be resolved to a media stream.\nThis can be due to an invalid URL or incompatable site.') }

        try { resource = createAudioResource(stream.stream, { inputType: stream.type || StreamType.Arbitrary, inlineVolume: true }) } catch(err) { log('Conversion to AudioResource Error', err) }

        return resource

    }

    async ffmpeg(seek = false, customArgs = new Array()) { 

        let stream = null; let resource; let type = StreamType.Arbitrary

        if (!seek) { seek = parseInt((this.parentQueue.players.music.currentResource.playbackDuration / 1000)?.toFixed()) } 

        const formatArgs = ['-f', 'opus', '-acodec', 'libopus']

        if (this.urls.scURL) {
            
            stream = await playDL.stream(this.urls.scURL).catch((err) => {
                log("Play-DL Stream Error", err)
            })
    
            const ffmpegArgs = [
                '-ss', `${seek}`,
                ...customArgs,
                ...formatArgs
            ]
            
            const ffmpeg = new prism.FFmpeg({
                args: ffmpegArgs,
            }).on('error', (err) => {
                try { ffmpeg.destroy() } catch { }
            })
                        
            pipeline(stream.stream, ffmpeg, () => { })
            stream = ffmpeg

        }

        else {

            if (customArgs.length === 0) {
                stream = new Object()
                stream = await playDL.stream_from_info(this.cached.ytInfo, { seek: seek })
                type = stream.type
                stream = stream.stream
            }
            else { 
                stream = ytdlCore(this.urls.ytURL, { filter: 'audioonly', highWaterMark: 1 << 25, fmt: 'opus', opusEncoded: false, seek: seek, encoderArgs: [...customArgs] })
            }
            
        }
        
        if (!stream) { throw new Error('The link to this song cannot be resolved to a media stream.\nThis can be due to an invalid URL or incompatable site.') }

        try { resource = createAudioResource(stream, { inputType: type, inlineVolume: true }) } catch(err) { log('Conversion to AudioResource Error', err) }

        if (!resource) { throw new Error('The audio from your file could not be converted into the proper format to play on Ducky.') }
        this.parentQueue.players.music.currentResource = resource

        this.parentQueue.players.music.currentResource.playbackDuration = this.parentQueue.players.music.currentResource.playbackDuration + (seek * 1000) // Move to function, eventually 
        await this.parentQueue.players.music.player.play(resource)

        return true 

    }

    async getSuggestedSong() { 

        if (!this.ids.spID) { throw new Error('Suggested songs are currently only available from tracks derived from Spotify.') }

        const SpotifyApi = new Spotify({
            clientId: process.meta.config.apiKeys.spClientID,
            clientSecret: process.meta.config.apiKeys.spSecret,
            redirectUri: process.meta.config.misc.links.spRedirect
        })

        const defaultKey = JSON.parse(fs.readFileSync('./.data/spotify.data', 'utf-8'))
        let write = false

        let tokens = await checkSpToken(defaultKey)

        if (tokens.access_token !== defaultKey.access_token) { write = true }

        defaultKey.refresh_token = tokens.refresh_token
        defaultKey.access_token = tokens.access_token
        defaultKey.expiry = tokens.expiry
        
        if (write) try {
            fs.writeFileSync('./.data/spotify.data', JSON.stringify(defaultKey, null, 2))
        } catch (err) { log("SP Data File Error", err) }
    
        SpotifyApi.setAccessToken(tokens.access_token)

        const trackIds = new Array()
        trackIds.push(this.ids.spID)
        let count = 1
        this.parentQueue.songs.previous.forEach((song) => { 
            if (song?.ids?.spID && count < 5 && !song.meta.ignoreSuggested) { trackIds.push(song?.ids?.spID) } // can only have 5 seeds, for now
            count += 1
        })

        let reccomendations = new Array()

        let reccomendationsResp = await SpotifyApi.getRecommendations({
            min_popularity: 30,
            seed_tracks: trackIds
        }).catch((err) => { log("Spotify API Error", err); throw new Error(err) })

        reccomendations.push(...reccomendationsResp?.body?.tracks)

        function checkPrevious(checkSong, higher) { 
        
            let includes = false
            higher.parentQueue.songs.previous.forEach((song) => {
                if (song.ids.spID === checkSong.id) { includes = true }
            })
            if (higher.ids.spID === checkSong.id) { includes = true }
            return includes

        }

        reccomendations.filter((song) => checkPrevious(song, this))
        
        let spReccomended = reccomendations[0]
        if (!spReccomended) { throw new Error('No more reccomendations could be found based on the current seeds.') }
        
        let ytReccomended = await convertSpToYt(spReccomended)

        let resolvedReccomended = new song(null, this.requester, this.linkedChannel, null, null, ytReccomended, spReccomended)
        resolvedReccomended.meta.suggested = true // tell any accessors that this is a suggested song 
        return resolvedReccomended

    }

    async getAristDetails() { 

        let parRegex = / *\([^)]*\) */g; let barRegex = / *\[[^)]*\] */g
        let derivedSearch = `${this.artists[0]} ${this.titles.display.normal.replace(parRegex, '').replace(barRegex, '')}`
        let searchURL = encodeURI(`https://api.genius.com/search?access_token=${process.meta.config.apiKeys.genius.accessToken}&q=${derivedSearch}`)
            
        let searchResp;
        try { searchResp = await fetch(searchURL, { headers: { }}) } catch(err) { log('Genius Request Error', err) }
        if (!searchResp) { throw new Error('Failed first request of Genius API.') }

        let searchResults;
        try { searchResults = await searchResp.json() } catch (err) { log('Genius Parse Error', err); throw new Error('Failed parsing the search API.') }

        let artistURL = encodeURI(`https://api.genius.com/artists/${searchResults?.response?.hits[0].result?.primary_artist?.id}?access_token=${process.meta.config.apiKeys.genius.accessToken}&text_format=plain`)
            
        let artistResp;
        try { artistResp = await fetch(artistURL, { headers: { }}) } catch(err) { log('Genius Request Error', err) }
        if (!artistResp) { throw new Error('Failed artist request of Genius API.') }
        
        let artistData;
        try { artistData = await artistResp.json() } catch (err) { log('Genius Parse Error', err); throw new Error('Failed parsing the search API.') }

        let artistSongsURL = encodeURI(`https://api.genius.com/artists/${searchResults?.response?.hits[0].result?.primary_artist?.id}/songs?access_token=${process.meta.config.apiKeys.genius.accessToken}&sort=popularity`)
            
        let songsResp;
        try { songsResp = await fetch(artistSongsURL, { headers: { }}) } catch(err) { log('Genius Request Error', err) }
        if (!songsResp) { throw new Error('Failed artist request of Genius API.') }
        
        let songsData;
        try { songsData = await songsResp.json() } catch (err) { log('Genius Parse Error', err); throw new Error('Failed parsing the search API.') }

        const artist = artistData.response.artist; const songs = songsData.response.songs

        const artistStructure = { 

            name: artist.name, description: artist.description.plain, landscapeImg: artist.header_image_url,
            squareImg: artist.image_url, url: artist.url, socials: { facebook: artist.facebook_name || null, insta: artist.instagram_name || null, twitter: artist.twitter_name || null },
            verified: artist.is_verified, alternateNames: artist.alternate_names, topSongs: new Array()
        }

        for (const song of songs) { 
            artistStructure.topSongs.push({
                title: song.title, artist: artist.name, fullTitle: song.full_title,
                released: song.release_date_for_display, url: song.url, coverArt: song.header_image_url
            })

        }

        return artistStructure 
        
    }

    async getGeniusDetails() { 

        let parRegex = / *\([^)]*\) */g; let barRegex = / *\[[^)]*\] */g
        let derivedSearch = `${this.artists[0]} ${this.titles.display.normal.replace(parRegex, '').replace(barRegex, '')}`
        let searchURL = encodeURI(`https://api.genius.com/search?access_token=${process.meta.config.apiKeys.genius.accessToken}&q=${derivedSearch}`)
            
        let searchResp;
        try { searchResp = await fetch(searchURL, { headers: { }}) } catch(err) { log('Genius Request Error', err) }
        if (!searchResp) { throw new Error('Failed first request of Genius API.') }

        let searchResults;
        try { searchResults = await searchResp.json() } catch (err) { log('Genius Parse Error', err); throw new Error('Failed parsing the search API.') }

        let primaryResult = searchResults?.response?.hits.filter(result => result.type === 'song')[0]?.result
        if (!primaryResult) { throw new Error('Failed to parse information from Genius API.') }

        let infoURL = encodeURI(`https://api.genius.com/songs/${primaryResult.id}?access_token=${process.meta.config.apiKeys.genius.accessToken}&text_format=plain`)

        let infoResp;
        try { infoResp = await fetch(infoURL, { }) } catch(err) { log('Genius Request Error', err) }
        if (!infoResp) { throw new Error('Failed second request of Genius API.') }

        let infoData;
        try { infoData = await infoResp.json() } catch (err) { log('Genius Parse Error', err); throw new Error('Failed parsing the search API.') }

        let songData = infoData?.response?.song || new Object()

        let infoStructure = {
            geniusURL: songData.url,
            description: songData.description?.plain, albumArt: this.coverArt, released: songData.release_date_for_display,
            title: this.titles.display.normal, album: { title: songData.album?.name, geniusURL: songData.album?.url },
            artist: { name: songData.primary_artist?.name, image: songData.primary_artist?.image_url || songData.primary_artist?.header_image_url || null, },
            sources: new Array(), writers: new Array(), producers: new Array(), relatedSongs: { covers: new Array(), live: new Array(), remixes: new Array() }
        }

        for (const [key, source] of Object.entries(songData?.media)) {
            infoStructure.sources.push({
                name: source?.provider || 'Unknown Source', url: source?.url
            })
        }

        for (const [key, artist] of Object.entries(songData?.producer_artists)) {
            infoStructure.producers.push({
                name: artist?.name || 'Unknown Artist', url: artist.image_url || artist.header_image_url || null
            })
        }

        for (const [key, artist] of Object.entries(songData?.writer_artists)) {
            infoStructure.writers.push({
                name: artist?.name || 'Unknown Artist', url: artist.image_url || artist.header_image_url || null
            })
        }

        for (const [key, songObj] of Object.entries(songData?.song_relationships)) {

            let acceptedTypes = ['covered_by', 'remixed_by', 'performed_live_as']

            if (acceptedTypes.includes(songObj.type)) { 

                let count = 0
                for (const song of songObj.songs) { 

                    if (songObj.type === 'covered_by') { 

                        if (count <= 4) { infoStructure.relatedSongs.covers.push({ name: song.title, artist: song.primary_artist.name, url: song.url }) }
                        count += 1

                    }

                    else if (songObj.type === 'remixed_by') { 

                        if (count <= 4) { infoStructure.relatedSongs.remixes.push({ name: song.title, artist: song.primary_artist.name, url: song.url }) }
                        count += 1

                    }

                    else if (songObj.type === 'performed_live_as') { 

                        if (count <= 5) { infoStructure.relatedSongs.live.push({ name: song.title, artist: song.primary_artist.name, url: song.url }) }
                        count += 1

                    }

                }

            }


        }

        this.info = infoStructure // update info prop with new data
        return infoStructure
    
    }

    embed(playlist, type = null) { 

        const config = process.meta.config.ui

        const types = { 
            UPCOMING: "upcoming",
            CURRENT: "current"
        }

        const ui = { 

            title: null, 
            url: null,
            author: { text: null, image: null },
            description: new Array(),
            fields: new Array(), 
            image: null, 
            footer: null,
            color: config.colors[Math.floor(Math.random() * config.colors.length)] // Picks a random color 
            
        }

        if (!type) { 

            if (this.parentQueue?.songs?.upcoming?.filter(song => song._internalId === this._internalId)?.length > 0) { 

                type = types.UPCOMING

            } else { type = types.CURRENT }

        } 

        const emoji = { 

            bullet: `<:${ui.color.substring(1)}:${config.bullets[ui.color]}>` // Fancy backend emoji stuff

        }

        ui.title = this.titles?.display?.normal

        ui.url = this.urls?.spURL || this.urls?.ytURL || this.urls?.scURL || this.urls?.rawURL || 'https://www.youtube.com/watch?v=blpe_sGnnP4'
        
        let artist = this.artists[0]
        if (this.artists.length === 2) { artist = this.artists.join(' and ') }

        ui.author.text = limit(artist, 250, '...')
        ui.author.image = config.notes[ui.color] // Fancy backend image stuff

        let releaseDate;

        if (this.releaseDate || this.sources?.yt?.uploadedAt?.includes('-')) {

            let parsed = DateTime.fromISO(this.releaseDate || this.sources?.yt?.uploadedAt)
            releaseDate = parsed.toLocaleString(DateTime.DATE_MED)

        }

        if (type === types.CURRENT) { 

            if (this.metaType !== songTypes.PARTIAL) { ui.description.push(`${emoji.bullet} From **[${limit(this.album, 33, '...')}](https://open.spotify.com/album/${this.sources?.sp?.album?.id})**\n`)}
            
            else if (this.metaType === songTypes.PARTIAL) { ui.description.push(`${emoji.bullet} ${Str(this.sources?.yt?.description)?.limit(44, `... [hover to read more](${this.urls.ytURL} "${this.sources?.yt?.description}")`)?.get() || 'No video description found.'}\n`) }

            if (this.metaType === songTypes.ARBITRARY) { ui.description.push(`**${this.duration?.formatted}** min ${this.emoji.bullet} From **${this.meta.raw.fromDomain || 'cdn.discordapp.com'}**`) }

            else {
                ui.description.push(`**${this.duration?.formatted}** min ${emoji.bullet} Released **${releaseDate || this.sources?.yt?.uploadedAt}**`)
                ui.description.push(`Found on **[Spotify](${this.urls.spURL})** ${emoji.bullet} ${this.explicit ? 'Contains **explicit** content' : '**Not** explicit'}`)
            }
        
        }

        else if (type === types.UPCOMING) { 

            let distance = this.parentQueue?.songs?.upcoming?.indexOf(this) + 1
            ui.description.push(`**${distance} ${wordChoice(distance, 'song')}** away in the queue.\n\n`)

            let secondsUntil = this.parentQueue?.songs?.current?.duration?.sec - (this.parentQueue?.players?.music?.currentResource?.playbackDuration / 1000)?.toFixed() || 0
            
            for (const song of this.parentQueue?.songs?.upcoming) { 

                if (song._internalId === this._internalId) { break }
                secondsUntil += song.duration.sec || 0

            }
            
            if (!this.parentQueue?.songs?.current) { secondsUntil = 'N/A' }

            ui.description.push(`**${formatDur(secondsUntil)}** min away ${emoji.bullet} By **${this.artists[0]}**`)

        }
        
        ui.description = ui.description.join('\n')

        const embed = new EmbedBuilder()
            .setTitle(ui.title)
            .setDescription(ui.description)
            .setAuthor({ name: ui.author.text, iconURL: ui.author.image })
            .setColor(ui.color)
            .setFooter({ text: "Ducky • Experimental UI", iconURL: config.sprouts[ui.color] })
            .setURL(ui.url)
            .setThumbnail(this.coverArt)
            
        this.parentQueue.textChannel.send({ embeds: [embed], components: this.parentQueue.getPlayButtons(this) })

    }
    
    getEmbed(firstUse = false, type = false) { 

        this.embed() // for testing

        let queue = process.meta.queues.get(this.linkedChannel.guild.id)
        if (!type) {
            type = 'np'; 
            for (const song of queue.songs.upcoming) {
                if (song._internalId === this._internalId) { type = 'q' }
                if (song._internalId === queue.songs.current._internalId) { type = 'np' }
            }
        }

        const RichEmbed = new EmbedBuilder()
        if (!this.sources.sc) { RichEmbed.setTitle(this.titles.display.normal) }
        if (this.type === 'existing') { RichEmbed.setTitle(this.titles.display.normal + ` <:remembered:${process.meta.config.botSettings.buttons.cached}>`) }
        RichEmbed.setURL(this.urls.duckyURL)

        let mobileMode = false
        if (this.requester?.presence?.clientStatus?.mobile === 'online') { mobileMode = true }
        
        if (type === 'np') { RichEmbed.setAuthor({ name: `Playing`, iconURL: process.meta.config.botSettings.styles.playing }) }
        else { RichEmbed.setAuthor({ name: `Enqueued`, iconURL: process.meta.config.botSettings.styles.queued }) }
        
        let color = '6ae2e2' 
        if (this.requester?.displayHexColor && this.requester?.displayHexColor !== '#000000') { color = this.requester.displayHexColor }
        RichEmbed.setColor(color)

        let toAdd = ''
        if (queue.loops.currentSong) { toAdd = 'The current song is looped.' }
        else if (queue.loops.entireQueue) { toAdd = 'All upcoming songs are looped.' }

        if (queue.modes.dynamic) { toAdd = `Dynamic Volume is enabled.` }
        else if (queue.modes.spatial) { toAdd = `Enhanced Audio is enabled.` }

        if (this.meta.voice) { 
            toAdd = `This song was requested via a voice interaction.`
        }

        let parRegex = / *\([^)]*\) */g; let barRegex = / *\[[^)]*\] */g
        if ((this.sources?.sp?.album?.name || this.album) && type === 'np') { RichEmbed.setDescription(`On [${this.album?.replace(parRegex, '')?.replace(barRegex, '')}](https://open.spotify.com/album/${this.sources?.sp?.album?.id})\n${toAdd}`) }
        else if (type !== 'np') {
            let dist = queue?.songs?.upcoming?.indexOf(this) + 1
            RichEmbed.setDescription(`This song is **${dist} ${wordChoice(dist, 'song')}** away.\n${toAdd}`)
        } 
        
        if (this.meta.playlist.partOfPlaylist && firstUse) {
            RichEmbed.setDescription(`Included in [${this.meta.playlist.name}](${this.meta.playlist.url})\n${this.meta.playlist.len} ${wordChoice(this.meta.playlist.len, 'song')} ${this.meta.playlist.len === 1 ? 'has' : 'have'} been added to the upcoming queue.\n${toAdd}`)
        }
        else if (this.meta.playlist.partOfPlaylist) {
            RichEmbed.setDescription(`Included in [${this.meta.playlist.name}](${this.meta.playlist.url})\n${toAdd}`)
         }
        if (this.type === 'partial' && !mobileMode) { RichEmbed.setDescription(Str(this.sources?.yt?.description)?.limit(44, `... [hover to read more](${this.urls.duckyURL} "${this.sources?.yt?.description}")`)?.get() || 'No YouTube video description provided.' + `\n${toAdd}`) }
        if (this.type === 'partial' && mobileMode) { RichEmbed.setDescription(Str(this.sources?.yt?.description)?.limit(44, ` ...`)?.get() || 'No YouTube video description provided. ' + `\n${toAdd}`) }

        else if (this.type === 'arbitrary') {
            RichEmbed.setDescription(`Playing via Ducky's external media extractor.\nCertain features are unavailable.`)
        }
        
        if (this.meta.suggested) { 
            RichEmbed.setDescription(`AutoPlay is enabled.\nThis is a suggested song based on previous songs.`)
        }

        RichEmbed.setThumbnail(this.coverArt)

        let fields = [];

        let combinedArtists;
        if (this.artists.length < 2) { combinedArtists = this.artists.join(', ') }
        else {
            let lastArtist = this.artists.pop()
            combinedArtists = this.artists.join(', ') + ' and ' + lastArtist
            this.artists.push(lastArtist)
        }
        
        if (!mobileMode && this.type !== 'arbitrary' && this.type !== 'partial') { fields.push({ name: wordChoice(this.artists.length, 'Artist'), value: combinedArtists, inline: true }) }
        else if (this.type === 'partial') { fields.push({ name: wordChoice(this.artists.length, 'Uploader'), value: combinedArtists, inline: true }) }

        let released;

        if (this.releaseDate || this.sources?.yt?.uploadedAt?.includes('-')) {

            let parsed = DateTime.fromISO(this.releaseDate || this.sources?.yt?.uploadedAt)
            released = parsed.toLocaleString(DateTime.DATE_MED)

        }
        
        if (this.meta.playlist.partOfPlaylist && firstUse) { fields.push({name: 'Playlist Length', value: `${this.meta.playlist.len + 1} ${wordChoice(this.meta.playlist.len, 'song')}`, inline: true }) }
        else if (!mobileMode && this.type !== 'arbitrary' && this.type !== 'backup' && this.releaseDate) { fields.push({name: 'Released', value: released || this.sources?.yt?.uploadedAt || 'Unknown Date', inline: true }) }
        else if (this.sources?.yt?.uploadedAt) { fields.push({name: 'Uploaded', value: released || this.sources?.yt?.uploadedAt || 'Unknown Date', inline: true }) }
        else if (this.type === 'backup') { fields.push({ name: 'Verified', value: this.sources?.sc?.publisher ? 'Yes' : 'No', inline: true }) }

        if (type === 'np') { if (!mobileMode) { fields.push({name: 'Duration', value: this.duration?.formatted + ' min', inline: true}) } }
        else { 
            
            let until = queue?.songs?.current?.duration?.sec - (queue?.players?.music?.currentResource?.playbackDuration / 1000)?.toFixed() || 0
            for (const song of this.parentQueue?.songs?.upcoming) { 

                if (song._internalId === this._internalId) { break }
                until += song.duration.sec

            }
            if (!queue?.songs?.current) { until = 'Not Calculatable' }
            
            if (!mobileMode) { fields.push({ name: 'Playing In', value: until === 'Not Calculatable' ? until : formatDur(until) + ' min', inline: true }) }
        }

        if (this.type === 'arbitrary') { fields.push({ name: 'Source', value: this.meta.raw.fromDomain, inline: true })    }

        RichEmbed.addFields(fields)
        RichEmbed.setFooter({ text: mobileMode ? `${process.meta.config.botSettings.styles.footer.text}\nThis message has been optimized for mobile viewing.` : process.meta.config.botSettings.styles.footer.text, iconURL: process.meta.config.botSettings.styles.footer.altIcon })

        return RichEmbed

    }

    getNewInternalID() { 

        const allCreatedIDs = JSON.parse(fs.readFileSync('./resources/idPool.json'))
    
        const createKey = customAlphabet('1234567890', 18)
    
        let newID = createKey()
    
        while (allCreatedIDs.includes(newID)) { newID = createKey() }
        
        allCreatedIDs.push(newID)
    
        if (process.meta.config.misc.cacheSongs) { fs.writeFileSync('./resources/idPool.json', JSON.stringify(allCreatedIDs)) }
    
        return newID
    
    }

    async startSyncedLyrics(msg, type = 'mini', lyrics = null, description = null) { 

        if (!lyrics) { try { lyrics = await this.getLyricsFormatted(this.ids.spID) } catch (err) { }}

        if (!lyrics) { return await msg.edit({ embeds: [WarningEmbed('Spotify / Musixmatch do not offer lyrics for this track.', `Check back soon - new lyrics are being constantly sourced!`)], ephemeral: true }).catch((err) => { log('Interaction Error', err) })     }

        this.parentQueue.lyrics.lyricsInProgress = true 
        this.parentQueue.lyrics.typeInProgress = type
        this.parentQueue.lyrics.currentLine = null
        this.parentQueue.lyrics.description = null

        let currentLyricLine = null; let lastLyricLine = null 

        this.parentQueue.lyrics.interval = setInterval(() => { 

            lastLyricLine = currentLyricLine;

            for (let line of lyrics) { 

                if ((line.timeInMs - 200) <= this.parentQueue?.players?.music?.currentResource?.playbackDuration) { currentLyricLine = line }

            }

            let triFormat = {
                last: lyrics[lyrics.indexOf(currentLyricLine) - 1],
                current: currentLyricLine,
                next: lyrics[lyrics.indexOf(currentLyricLine) + 1]
            }

            if (lastLyricLine?.words == currentLyricLine?.words) {  }            

            else {
                this.parentQueue.events.emit('NewLyricLine', triFormat, msg, description)
            }


        }, 50)
        
    }

    async getSpotifyToken() { 
    
        let accessTokenResponse
        try { accessTokenResponse = await fetch('https://open.spotify.com/get_access_token?reason=transport&productType=web_player', { headers: { 'accept': 'application/json', 'accept-language': 'en', 'app-platform': 'WebPlayer', 'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin', 'spotify-app-version': '1.1.54.35.ge9dace1d', 'cookie': process.meta.config.apiKeys.spCookie, }, 'referrer': 'https://open.spotify.com/', 'referrerPolicy': 'no-referrer-when-downgrade', body: null, method: 'GET', mode: 'cors' }) } catch(err) { log('SP Request Error', err) }
        if (!accessTokenResponse) { throw new Error('Cannot authorize Spotify gate.') }
        return (await accessTokenResponse.json())?.accessToken
    
    }
    
    async getLyricsFormatted(id) {
    
        let accessToken; let append = null 
        try { accessToken = await this.getSpotifyToken() } catch(err) { log('AccessTokenError', err ) }
        if (!accessToken) { throw new Error('Cannot authorize Spotify gate.') }
    
        let lyricsResponse;
        try { lyricsResponse = await fetch(`https://spclient.wg.spotify.com/color-lyrics/v2/track/${id}`, { 'headers': { 'accept': 'application/json', 'accept-language': 'en', 'app-platform': 'WebPlayer', 'Authorization': `Bearer ${accessToken}`, 'sec-ch-ua-mobile': '?0', }, 'body': null, 'method': 'GET', 'mode': 'cors', }) } catch(err) { log('SP Request Error', err) }
        if (!lyricsResponse) { throw new Error('Failed requesting the lyrics JSON.') }
    
        let response; 
        let results = []; try { response = await lyricsResponse.json() } catch { throw new Error('Failed parsing the lyrics JSON.') }
        for (let line of response?.lyrics?.lines) { results.push({ timeInMs: line?.startTimeMs, words: line?.words }) }
        for (const line of results) { if (line.words == '' || line.words == '♪') { line.words = `<:instrumental:${process.meta.config.botSettings.buttons.instrumentalPlaceholder}>` }}
    
        let creditsResponse; let credits;
        try { creditsResponse = await fetch(`https://spclient.wg.spotify.com/track-credits-view/v0/experimental/${id}/credits`, { 'headers': { 'accept': 'application/json', 'accept-language': 'en', 'app-platform': 'WebPlayer', 'Authorization': `Bearer ${accessToken}`, 'sec-ch-ua-mobile': '?0', }, 'body': null, 'method': 'GET', 'mode': 'cors', }) } catch(err) { log('SP Request Error', err) }
        if (creditsResponse) { try { credits = await creditsResponse.json() } catch { } } 
    
        if (credits) { 
    
            let appendArr = new Array()
            if (credits.roleCredits[0]?.artists?.length > 0) {
                let artists = []
                for (const artist of credits.roleCredits[0]?.artists) { 
                    artists.push(artist.name)
                }
                appendArr.push(`Performed by ${artists.join(', ')}`)
            }
            if (credits.roleCredits[1]?.artists?.length > 0) {
                let artists = []
                for (const artist of credits.roleCredits[1]?.artists) { 
                    artists.push(artist.name)
                }
                appendArr.push(`Written by ${artists.join(', ')}`)
            }
            if (credits.roleCredits[2]?.artists?.length > 0) {
                let artists = []
                for (const artist of credits.roleCredits[2]?.artists) { 
                    artists.push(artist.name)
                }
                appendArr.push(`Produced by ${artists.join(', ')}`)
            }
    
            append = { timeInMs: 'CREDITS', words: appendArr.join('\n') }
    
        }    
    
        if (append) { results.push(append) } // adds credits to last line
    
        return results 
    
    }
        

}

export class writeableSong { 

    constructor(songData, libraryData = null) { 
        
        this.ids = songData.ids
        this.urls = songData.urls
        this.titles = songData.titles
        this.artists = songData.artists
        this.explicit = songData.explicit
        this.coverArt = songData.coverArt
        this.duration = songData.duration
        this.popularity = songData.popularity
        this.sources = songData.sources
        this.meta = songData.meta
        this.info = songData.info
        this.album = songData.album
        this.timesPlayed = libraryData?.timesPlayed || null 
        this.releasedYear = songData.releasedYear
        this.releaseDate = songData.releaseDate
        this.writable = true 

    }

    createEntry() {
        
        createDBEntry(this, 'songs')
        
    } 

    updateEntry(key, value) {

        this[key] = value
        updateDBEntry(this.ids.duckyID, key, value, 'songs')
        
    }

    addToUserHistory(user) { 

        this.timestamp = new Date().getTime()
        user.history.push(this)
        user.save()
        return true 

    }

}


function parseMusic(ytResult) { 

    if (!ytResult) { return null }

    if (ytResult?.music && ytResult?.music?.length > 0) {

        for (const musicData of ytResult?.music) {

            if (musicData?.song) { return { song: musicData.song, artist: musicData.artist }; }
            for (const [key, value] of Object.entries(musicData)) { 

                if (value?.text) { return { song: value.text, artist: null }}

            }

        }
    }

    else {
        
        let parRegex = / *\([^)]*\) */g; let barRegex = / *\[[^)]*\] */g
        return { song: ytResult?.title?.replace(parRegex, '').replace(barRegex, '') }
    
    }

}

function formatDur(timeInSeconds) {
    const date = new Date(null);
    date.setSeconds(timeInSeconds);
    const timeString = date.toISOString().substr(11, 8);
    return timeString.replace(/^00:/, '').replace('0', ''); 
  }