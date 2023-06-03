'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import fs from 'fs'
import playDL from 'play-dl'
import { log } from './functions/misc.js'
import { createAudioPlayer, NoSubscriberBehavior, createAudioResource, AudioPlayerStatus } from '@discordjs/voice'

export default async function startRadios() { 

    log(`Radio Players`, `Ducky's radio players are now in startup`, true)

    const radios = process.meta.config.radios
    process.meta.radios = new Object()

    let initCount = 0

    for (const radio of radios) { 

        let audioPlayer = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play }})

        process.meta.radios[radio.name.toLowerCase().split(' ').join('-')] = { 

            player: audioPlayer,
            name: radio.name, 
            description: radio.description,
            originalPlaylist: radio.url,
            backendName: radio.name.toLowerCase().split(' ').join('-')

        }

        const file = `./resources/radios/${radio.name.toLowerCase().split(' ').join('-')}.json`
        const songs = JSON.parse(fs.readFileSync(file))
        
        audioPlayer.play(await getResource(songs[0]))
        let count = 0 

        audioPlayer.on(AudioPlayerStatus.Idle, async () => { 

            let nextSong = count += 1
            if (!songs[nextSong]) { count = 0; nextSong = count }

            let resource
            while (!resource) { 

                resource = await getResource(songs[nextSong]).catch((err) => { })
                if (!resource) { nextSong = nextSong += 1 }

            }
            
            audioPlayer.play(resource)

        })
        
        initCount += 1

    }

    log('Radio Players', `Initiated ${initCount} / ${process.meta.config.radios.length} radio players`)

}

async function getResource(song) {

    let stream = null; let info = null
    try {

        info = await playDL.video_info(song.url).catch((err) => { })
        if (!info) { return false }

        stream = await playDL.stream_from_info(info).catch((err) => { })
        if (!stream) { return false }
             
        
    } catch {

        return false
        
    }

    let resource = createAudioResource(stream?.stream, { inputType: stream?.type })

    return resource || false

}

