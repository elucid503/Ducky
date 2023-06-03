'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { createAudioResource, AudioPlayerStatus } from '@discordjs/voice';
import { log, sleep } from '../functions/misc.js'
import { song, writeableSong } from './song.js'
import { customAlphabet } from 'nanoid'
import play from 'play-dl'
import fs from 'fs'
export class playlist { 

    constructor(existingData = null, creator = null, customData = { name: null, description: null, spID: null }, libraryData = null) {

        this.ids = { duckyID: existingData?.ids?.duckyID || getNewInternalID(), spID: customData.spID || null }
        this.url = `${process.meta.config.misc.apiDomain}/playlists/${this.id}`
        this._internalId = getNewInternalID() // differentiates from a possibly already-existing duckyID
        this.songs = [] // to be pushed later on 
        this.creator = existingData?.creator || creator
        this.name = existingData?.name || customData?.name || `ducky-playlist-${this.ids.duckyID}` 
        this.description = customData.description // this should be limited on the command 
        this.timesPlayed = libraryData?.timesPlayed || null 

    }

    async addPartialSongs(partialSongs = []) {
    
        for (const partialSong of partialSongs) { 
            
            if (partialSong?.track?.album?.available_markets) { partialSong.track.album.available_markets = new Array() } 
            if (partialSong?.track?.available_markets) { partialSong.track.available_markets = new Array() } 
            let resolvedSong = new song(null, null, null, null, null, null, partialSong.track || partialSong)
                        
            this.songs.push(resolvedSong)

        }
    }

    addUnresolved(unresolvedSongs = [], channel, requester) { 

        for (const partialSong of unresolvedSongs) {

            let fullSong = new song(partialSong, requester, channel, null, { url: this.url, part: true, name: this.name, len: unresolvedSongs.length - 1 || 0 })

            this.songs.push(fullSong)

        }

        return true 

    }

    convertToWritable() { 

        let writable = new Array()

        for (const fullSong of this.songs) {

            let converted = new writeableSong(fullSong)

            writable.push(converted)
            
        }

        this.songs = writable
        return true 

    }


    addResolvedSongs(songs = []) { // does not need to be async!!

        let writableSongs = new Array()

        for (let song of songs) { 

            let writable = new writeableSong(song || { error: true, message: "No data provided"})
            writableSongs.push(writable)

        }

        this.songs.push(... writableSongs)

    }

    async addThisToQueue(queueInstance) { 

        for (let readSong of this.songs || []) { 

            let resolvedSong = new song(readSong) // does not need any other data (for now)
            queueInstance.add(resolvedSong)

        }

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
export class soundboard {

    constructor(existingData) {

        this.slot0 = { url: existingData?.slot0?.url || 'https://www.youtube.com/watch?v=2ZIpFytCSVc', name: existingData?.slot0?.name || "Bruh" }
        this.slot1 = { url: existingData?.slot1?.url || 'https://www.youtube.com/watch?v=829pvBHyG6I', name: existingData?.slot1?.name || "Vine Boom" } 
        this.slot2 = { url: existingData?.slot2?.url || 'https://www.youtube.com/watch?v=D1wGOHHiMeU', name: existingData?.slot2?.name || "Windows XP" } 
        this.slot3 = { url: existingData?.slot3?.url || 'https://www.youtube.com/watch?v=KsymrAGpCak', name: existingData?.slot3?.name || "What!" }
        this.slot4 = { url: existingData?.slot4?.url || 'https://www.youtube.com/watch?v=gP3MuUTmXNk', name: existingData?.slot4?.name || "Law and Order" } 

    }

    async playSound(queue, slot = 0) { 

        let index = 0; let url = null 
        for (const [key, val] of Object.entries(this)) { 
            if (index == slot) {
                url = val.url
            }
            index += 1
        }

        let ytInfo = await play.video_info(url).catch((err) => { log("Play-DL SB Video Query Error", err)})
        let stream = await play.stream_from_info(ytInfo).catch((err) => {
            log("Play-DL SB Stream Error", err)
        })

        const resource = createAudioResource(stream.stream, { inputType: stream.type })

        if (queue.transitions.sb) {
            while (queue.transitions.sb) {

                await sleep(100)

            }
        }

        queue.switchPlayer('sounds')
        queue.transitions.sb = true 

        queue.players.sounds.player.play(resource) 

        queue.players.sounds.player.once(AudioPlayerStatus.Idle, () => { 

            queue.switchPlayer()
            queue.transitions.sb = false 

        }).on(AudioPlayerStatus.Error, () => {
           
            queue.switchPlayer()
            queue.transitions.sb = false 

        })

        return true 
    }

    async changeSound(slot, newURL, user, name) { 
        let index = 0; 
        for (const [key, val] of Object.entries(this)) { 
            if (index == slot) { this[key].url = newURL; this[key].name = name }
            index += 1
        }

        user.soundboard = this
        user.save()
        return true 
    }

}