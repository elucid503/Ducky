'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import playDL, { spotify } from 'play-dl'
import Spotify from 'spotify-web-api-node'
import ytdlWrap from 'youtube-dl-wrap'
import { log } from '../functions/misc.js'
import { fetchToken, fetchSong, formatArtworkUrl } from 'node-apple-music'
import fetch from 'node-fetch'; import { parseStream } from 'music-metadata'
import { getSong, checkCache } from '../classes/song.js'

const confidenceLevels = { MOST: -1, HIGH: 0, MED: 1, LOW: 2, NONE: 3 }
// this should be reconfigured 

Array.prototype.sortBy = function (p) { return this.slice(0).sort(function (a, b) { return (a[p] > b[p]) ? 1 : (a[p] < b[p]) ? -1 : 0; }); }

export async function searchPlatform(keyword, sourceObj, limit = 1) { // this a needed export for search command 

    if (sourceObj.spotify) { if (playDL.is_expired()) { await playDL.refreshToken() } }

    try {

        const searchResults = await playDL.search(keyword, { source: sourceObj, limit: limit })
        if (!searchResults || searchResults.length < 1) { return false }
        if (limit === 1) return searchResults[0] // object
        else return searchResults // array of objects

    } catch (error) { log('Search Error', error); log('Search Type', sourceObj); return false }
    
}

export async function searchForSong(input, force = 0, requester, channel, queue) {

    /* FORCE SEARCHES: 0 = SPOTIFY (DEFAULT), 1 = SOUNDCLOUD, 2 = YOUTUBE */
    const forceTypes = { 0: 'default', 1: 'so-search', 2: 'yt-search' }

    let searchType = forceTypes[force];
    if (!searchType) { throw new Error('A valid force-search int must be provided.\nCould not resolve provided type.') }

    let source = await playDL.validate(input); let searchURL
   
    try { searchURL = new URL(input) } catch { }
    
    if (searchURL) {
        
        if (input.includes('apple.com')) {
            source = 'amTrack';
        }

        else if (!source || source === 'search') {
            
            let rawInfo = await extractInfo(searchURL.href)

            let song = getSong(input, requester, channel, false, { youtube: null, soundcloud: null, spotify: null, raw: rawInfo })

            return song

        }
    }

    else if (!searchURL) { source = searchType } 

    if (source === 'default') {

        console.log('checking cache')
        let cached = await checkCache(input, requester, channel)
        console.log('checked cache')
        if (cached) { return cached }
        
        let bestYTResult, bestSPresult, bestSCResult
        
        console.log('querying Spotify')
        bestSPresult = await findSpResult(input).catch((err) => { })
        console.log('queried Spotify')

        console.log('querying YouTube')
        bestYTResult = await convertSpToYt(bestSPresult, { search: input }).catch((err) => { log("Search Error", err)})
        console.log('queried YouTube')

        let song = getSong(input, requester, channel, false, { youtube: bestYTResult, soundcloud: bestSCResult, spotify: bestSPresult })

        if (!song || song?.error) { throw new Error(song?.error || `There was an error parsing the song information.\nPlease try again or [contact support](${process.meta.config.misc.links.support}).`) }

        return song

    }

    else if (source === 'so-search') {

        let scResult
        try { scResult = await searchPlatform(input, { soundcloud: 'tracks' }) } catch (err) { log('Soundcloud Search Error', err) }

        if (!scResult) { throw new Error('Ducky could not find a matching song on SoundCloud.\nPlease check to make sure your song is available on Soundcloud.') }

        let song = getSong(input, requester, channel, false, { youtube: null, soundcloud: scResult, spotify: null })
        
        if (!song || song?.error) { throw new Error(song?.error || `There was an error parsing the song information.\nPlease try again or [contact support](${process.meta.config.misc.links.support}).`) }

        return song

    }
    
    else if (source === 'yt-search') {

        let ytResults; let bestYTResult

        try { ytResults = await searchPlatform(input, { youtube: 'video' }, 5) } catch (err) { log('YouTube Search Error', err) }

        if (!ytResults || ytResults?.length < 1) { throw new Error('Ducky could not find a matching video on YouTube.\nPlease check to make sure your search is available on YouTube.') }

        for (const result of ytResults) {

            for (const musicData of result?.music) {

                if (musicData.song.toLowerCase().includes(input.toLowerCase())) { bestYTResult = result; break }

            }

            if (result.title.toLowerCase().includes(input.toLowerCase())) { bestYTResult = result }
            if (result.title.toLowerCase() === input.toLowerCase()) { bestYTResult = result; break }

        }
        
        if (!bestYTResult) { bestYTResult = ytResults[0] }

        let song = getSong(input, requester, channel, false, { youtube: bestYTResult, soundcloud: null, spotify: null })
        
        if (!song || song?.error) { throw new Error(song?.error || `There was an error parsing the song information.\nPlease try again or [contact support](${process.meta.config.misc.links.support}).`) }

        return song

    }

    else if (source === 'sp_track') {

        let spotifyDetails

        if (playDL.is_expired()) { await playDL.refreshToken() }
        try { spotifyDetails = await playDL.spotify(input) } catch (err) { log('Spotify Resolve Error', err) }
        if (!spotifyDetails) { throw new Error('Ducky could not find this song on Spotify.\nPlease check to make sure this link is a valid Spotify song.') }

        let bestYTResult = await convertSpToYt(spotifyDetails)
        
        let song = getSong(input, requester, channel, false, { youtube: bestYTResult, soundcloud: null, spotify: spotifyDetails })
        
        if (!song || song?.error) { throw new Error(song?.error || `There was an error parsing the song information.\nPlease try again or [contact support](${process.meta.config.misc.links.support}).`) }

        return song

    }
    
    else if (source === 'so_track') {

        let soundcloudDetails;

        try { soundcloudDetails = await playDL.soundcloud(input) } catch (err) { log('SoundCloud Resolve Error', err) }
        if (!soundcloudDetails) { throw new Error('Ducky could not find this song on SoundCloud.\nPlease check to make sure this link is a valid SoundCloud song.') }

        let song = getSong(input, requester, channel, false, { youtube: null, soundcloud: soundcloudDetails, spotify: null })
        
        if (!song || song?.error) { throw new Error(song?.error || `There was an error parsing the song information.\nPlease try again or [contact support](${process.meta.config.misc.links.support}).`) }

        return song


    }

    else if (source === 'yt_video') { 

        let ytDetails

        try { ytDetails = await playDL.video_basic_info(input) } catch (err) { log('YouTube Resolve Error', err) }
        if (!ytDetails) { throw new Error('Ducky could not find this song on YouTube.\nPlease check to make sure this link is a valid YouTube video.') }
        
        ytDetails = ytDetails?.video_details
        ytDetails.dontinfer = true
        let song = getSong(input, requester, channel, false, { youtube: ytDetails, soundcloud: null, spotify: null })
        
        if (!song || song?.error) { throw new Error(song?.error || `There was an error parsing the song information.\nPlease try again or [contact support](${process.meta.config.misc.links.support}).`) }

        return song

    }

    else if (source === 'yt_playlist') { 

        let ytDetails; let allSongs 

        try { ytDetails = await playDL.playlist_info(input, { incomplete: true }) } catch (err) { log('YouTube Playlist Resolve Error', err) }
        if (!ytDetails) { throw new Error('Ducky could not find this playlist on YouTube.\nPlease check to make sure this link is a public playlist.') }

        try { allSongs = await ytDetails?.all_videos() } catch (err) { log('YouTube Playlist Video Fetch Error', err) }
        if (!allSongs) { throw new Error('Ducky could not find any videos in this playlist on YouTube.\nPlease check to make sure the videos this playlist contains are public.') }

        let duration = 0
        allSongs.forEach((ytResult) => { duration += ytResult.durationInSec })

        let song = getSong(input, requester, channel, { url: ytDetails.url, part: true, name: ytDetails.title, len: allSongs.length - 1, duration: duration }, { youtube: allSongs.shift(), soundcloud: null, spotify: null })

        if (!song || song?.error) { throw new Error(song?.error || `There was an error parsing the song information.\nPlease try again or [contact support](${process.meta.config.misc.links.support}).`) }

        let interval = setInterval(() => {
            
        if (!queue.transitions.pendingSync) {

             clearInterval(interval)

                allSongs.forEach((ytResult) => { 

                    let toAdd = getSong(input, requester, channel, { url: ytDetails.url, part: true, name: ytDetails.title, len: allSongs.length }, { youtube: ytResult, soundcloud: null, spotify: null })
                    queue.songs.upcoming.push(toAdd)
                    
                })
                
        } else { } }, 100)

        queue.update()
        queue.transitions.pendingSync = true 

        return song

    }

    else if (source === 'sp_album' || source === 'sp_playlist') { 

        if (playDL.is_expired()) { await playDL.refreshToken() }
        let spDetails; let spSongsData; let spSongs = new Array()

        try { spDetails = await playDL.spotify(input) } catch (err) { log('Spotify Playlist Resolve Error', err) }
        if (!spDetails) { throw new Error('Ducky could not find this playlist on Spotify.\nPlease check to make sure this link is a public playlist.') }

        try { spSongsData = await spDetails?.fetch() } catch (err) { log('Spotify Playlist Video Fetch Error', err) }
        if (!spSongsData) { throw new Error('Ducky could not find any videos in this playlist on Spotify.\nPlease check to make sure the songs this playlist contains are available.') }

        for (const entry of spSongsData?.fetched_tracks.entries()) {
            if (entry[1]) {
                for (const indidivual of entry[1]) { spSongs.push(indidivual) }
            }
        }

        let duration = 0
        spSongs.forEach((spResult) => { duration += spResult.durationInSec })

        let firstSong = spSongs.shift()
        firstSong.thumbnail = new Object()
        firstSong.thumbnail.url = spDetails.thumbnail.url 

        let ytResult = await convertSpToYt(firstSong)

        let song = getSong(input, requester, channel, { url: spDetails.url, part: true, name: spDetails.name, len: spSongs.length || 503, duration: duration }, { youtube: ytResult, soundcloud: null, spotify: firstSong })

        if (!song || song?.error) { throw new Error(song?.error || `There was an error parsing the song information.\nPlease try again or [contact support](${process.meta.config.misc.links.support}).`) }

        queue.update()

        spDetails.requester = requester
        spDetails.channel = channel

        addAllSpSongs(spSongs, spDetails, queue)

        return song

    }

    else if (source === 'amTrack') { 

        try { await fetchToken() } catch (err) { log('Apple Music Error', err); throw new Error(`Ducky could not communicate with the Apple Music API.\nPlease try again or [contact support](${process.meta.config.misc.links.support}).`) }

        let songID = input.split('i=')[1]
        let song 
        try { song = await fetchSong(songID) } catch(err) { log('Apple Music Error', err) }
        if (!song || song?.errors) { throw new Error(`Ducky could not find this song on Apple Music.\nPlease ensure you used the default link to the song.`) }

        let thumbnail = formatArtworkUrl(song?.attributes?.artwork)

        const rawInfo = new Object()        
        try { // None of these are guaranteed to actually be populated 
            rawInfo.title = song?.attributes?.name
            rawInfo.artist = song?.attributes?.artistName || 'Unknown Artist'
            rawInfo.id = song.id
            rawInfo.url = song.attributes.url || input
            rawInfo.domain = 'Apple Music'
            rawInfo.album = song.attributes?.albumName
            rawInfo.releaseDate = song.attributes?.releaseDate
            rawInfo.thumbnail = thumbnail || null
            rawInfo.duration = (song.attributes.durationInMillis / 1000).toFixed()
        } catch (err) { log('Raw Info Assignment Error', err) }

        let bestYTResult = await convertSpToYt(null, { search: rawInfo.title, name: rawInfo.title, artist: song?.attributes?.artistName || null }).catch((err) => { log("Search Error", err)})
        if (!bestYTResult) { throw new Error('This Apple Music track could not be converted into a playable song for Ducky.') }

        let resolved = getSong(input, requester, channel, false, { youtube: bestYTResult, soundcloud: null, spotify: null, custom: { coverArt: thumbnail, artists: [rawInfo.artist], titleNorm: rawInfo.title, album: rawInfo.album, releaseDate: rawInfo.releaseDate } })
        
        if (!resolved || resolved?.error) { throw new Error(resolved?.error || `There was an error parsing the song information.\nPlease try again or [contact support](${process.meta.config.misc.links.support}).`) }

        return resolved

    }

}

async function addAllSpSongs(spSongs, spDetails, queue) { 
 
    for (const song of spSongs) { 

        await addSpResultToQueue(song, spDetails, queue)

    }
}

async function addSpResultToQueue(spResult, playlistDetails, queue) {

        spResult.thumbnail = new Object()
        spResult.thumbnail.url = playlistDetails.thumbnail.url 

        let ytResult
    
        try { ytResult = await convertSpToYt(spResult) } catch (err) { log('Conversion To YT Error', err); }

        let song = getSong(null, playlistDetails?.requester || null, playlistDetails?.channel || null, { url: playlistDetails.url, part: true, name: playlistDetails.name}, { youtube: ytResult, soundcloud: null, spotify: spResult })

        if (!song || song?.error) { log('Song Conversion Error', song?.error || `There was an error parsing the song information.\nPlease try again or [contact support](${process.meta.config.misc.links.support}).`) }

        if (song) {
            
            queue.add(song, true)
        
        }
        
    return true

}

function calculatecConf(current) {

    if (current === -1) { return current } 
    return current - 1 // adds to the confidence of the video 

}

function isBetween(n, a, b) {
    return (n - a) * (n - b) <= 0
 }

export async function findScResult(spotifyDetails) { 

    if (!spotifyDetails) { return false }

    let results; let bestResult; 

    let search = `${spotifyDetails?.artists[0]?.name} ${spotifyDetails?.name} `

    try { results = await searchPlatform(search, { soundcloud: 'tracks' }, 15) } catch (err) { log('Soundcloud Search Error', err) }

    if (!results || results?.length < 1) { return false }
    
    for (const result of results) {

        result.confidence = confidenceLevels.NONE

        if (results.indexOf(result) === 0) { result.confidence = confidenceLevels.LOW } // automatically mark top result as "high" confidence

        let artists = new Array(); 
        if (result.publisher) { if (result?.publisher?.artist) artists.push(result?.publisher?.artist) }
        if (result.user) { if (result?.user?.name) artists.push(result?.user?.name) }

        for (let artist of artists) { 
            if (artist.includes(',')) { artists.push(... artist.split(',')) }
            if (spotifyDetails.artists.map(artist => artist.name.toLowerCase()).includes(artist)) {
                result.confidence = calculatecConf(result.confidence);
                break
            } 
        }

        if (result.name.toLowerCase() === spotifyDetails.name.toLowerCase()) { result.confidence = calculatecConf(result.confidence) }

        if (!isBetween(result.durationInSec, spotifyDetails.durationInSec - 10, spotifyDetails.durationInSec + 10)) { result.confidence = confidenceLevels.NONE  }
        
    }

    results = results.sortBy('confidence')
    bestResult = results[0]

    if (bestResult.confidence > 1) { return false }
    else { return bestResult }


}

export async function findSpResult(input) { 

    let results; let bestResult; 

    try { results = await searchPlatform(input, { spotify: 'track' }, 10) } catch (err) { log('Spotify Search Error', err) }

    if (!results || results?.length < 1) { return false }
    
    for (const result of results) { 

        result.confidence = confidenceLevels.LOW

        if (results.indexOf(result) === 0 && input.includes(result.name)) { result.confidence = confidenceLevels.MED } // automatically mark top result as high confidence

        if (result.durationInSec >= 1800) { result.confidence = result.confidence + 1 } 

    }

    results = results.sortBy('confidence')
    bestResult = results[0]
    
    if (bestResult.confidence > 2) { return false }
    else { return bestResult }

}

export async function convertSpToYt(spotifyDetails, input = { search: null, name: null, artist: null }) { 

    let videos = null; let bestVideo = null 

    if (!spotifyDetails) { 

        let search = `${input.artist} ${input.name}`
        if (!input.artist || !input.name) { search = input.search }  

        try { videos = await searchPlatform(search, { youtube: 'video' }, 5) } catch (err) { log('YouTube Search Error', err) }
        if (!videos || videos?.length < 1) { throw new Error('Ducky could not find a matching video on YouTube.\nPlease try a different song.') }

        return videos[0]
        
    }

    try { videos = await searchPlatform(`${spotifyDetails.artists[0]?.name} ${spotifyDetails.name}`, { youtube: 'video' }, 5) } catch (err) { log('YouTube Search Error', err) }

    if (!videos || videos?.length < 1) { throw new Error('Ducky could not find a matching video on YouTube.\nPlease try a different song.') }

    for (const video of videos) { 

        video.confidence = confidenceLevels.LOW

        if (videos.indexOf(video) === 0) { video.confidence = confidenceLevels.MED } // automatically mark top result as high confidence

        if (video.title.toLowerCase().includes(spotifyDetails.name.toLowerCase())) { video.confidence = calculatecConf(video.confidence) }

        if (spotifyDetails.artists.map(artist => artist.name.toLowerCase()).includes(video.channel.name.toLowerCase())) {
            video.confidence = calculatecConf(video.confidence)
            if (video.channel.artist) { video.confidence = calculatecConf(video.confidence) }
        }

        if (!isBetween(video.durationInSec, spotifyDetails?.durationInSec + 15, spotifyDetails?.durationInSec - 15)) { video.confidence = confidenceLevels.LOW }
    }

    videos = videos.sortBy('confidence')
    bestVideo = videos[0]

    return bestVideo
    
}

async function extractInfo(url) {
        
    const ytdl = new ytdlWrap(process.meta.config.misc.ytdlPath);
    let metadata; let playableFile = false

    if (!url.endsWith('.mp4') && !url.endsWith('.mp3') && !url.endsWith('.mov') && !url.endsWith('.m4a') && !url.endsWith('.webm') && !url.endsWith('.ogg') && !url.endsWith('.ogg')) try { metadata = await ytdl.getVideoInfo(url) } catch (err) { log('Metadata Error', err )}

    else {
       
        playableFile = true 
        try {
            let response = await fetch(url)
            metadata = await parseStream(response.body)
    
        } catch (err) { log('Metadata Error', err) }
    
    }

    if (!metadata) { throw new Error(`The URL you provided could not be resolved to a song or playable media file.\nIf this is a mistake, this website may be trying to block Ducky's media extractor.`) }

    let rawInfo = new Object()
    let splitURL = url.split('/')
    let domain = new URL(url)?.hostname

    try { // None of these are guaranteed to actually be populated 
        rawInfo.file = playableFile
        rawInfo.title = metadata?.title 
        if (!rawInfo.title && splitURL?.length > 0) rawInfo.title = splitURL[splitURL?.length - 1] 
        rawInfo.artist = metadata?.uploader || 'Unknown Artist'
        rawInfo.id = metadata?.id
        rawInfo.url = metadata?.webpage_url || url
        rawInfo.domain = domain
        if (metadata?.thumbnails || metadata?.thumbnails?.length > 0) { rawInfo.thumbnail = metadata?.thumbnails[0]?.url }
        rawInfo.duration = metadata?.duration?.toFixed() || metadata?.format?.duration?.toFixed()
    } catch (err) { log('Raw Info Assignment Error', err) }

    return rawInfo

} 

export async function checkSpToken(backup) { 

    let refresh_token = backup.refresh_token
    let access_token = backup.access_token
    let expiry = backup.expiry

    let isExpired = false
    if (Date.now() >= (expiry)) { isExpired = true }

    if (isExpired) { 

        const SpotifyApi = new Spotify({
            clientId: process.meta.config.apiKeys.spClientID,
            clientSecret: process.meta.config.apiKeys.spSecret,
            redirectUri: process.meta.config.misc.links.spRedirect
        })

        SpotifyApi.setAccessToken(access_token)
        SpotifyApi.setRefreshToken(refresh_token)

        let refreshResp = await SpotifyApi.refreshAccessToken().catch((err) => {
            log('Refresh Token Error', err)
            throw new Error('Could not refresh access token.')
        })
        
        return {
            refresh_token: refresh_token,
            access_token: refreshResp.body.access_token,
            expiry: Date.now() + (refreshResp.body.expires_in - 1) * 1000
        } 
    }

    else { 

        return { 
            refresh_token: refresh_token,
            access_token: access_token,
            expiry: expiry
        } 

    }

}


