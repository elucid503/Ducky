'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType  } from 'discord.js'
import { checkUsability, log } from '../functions/misc.js'
import { CreateEmbed } from "../functions/interface.js"

const command = new Object()
command.name = 'seek'
command.description = `Fast forward or rewind 15 seconds in the current song.`
command.options = [ { name: "mode", description: 'Choose whether to rewind or fast forward.', choices: [ { name: 'Rewind', value: 'rw' }, { name: 'Fast Forward', value: 'ff' } ], type: ApplicationCommandOptionType.String, required: true }  ]
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 5

async function execute(interaction, resolvedUser, discordClient) { 

    const mode = interaction.options.get('mode').value

    let queue = process.meta.queues.get(interaction.guild.id)
    if (!queue) { return interaction.reply({ embeds: [WarningEmbed("Ducky is not playing anything in this server.", `To control playback, join a voice channel and play a song first.`)], components: [], ephemeral: true }).catch(() => {})  }
    if (!queue.songs.current) { return interaction.reply({ embeds: [WarningEmbed("There is no song currently playing.", `To control audio playback, a song must be playing first.`)], components: [], ephemeral: true }).catch(() => { }) }

    try { await checkUsability(interaction.member, interaction.guild) } catch (error) { 

        let joinableError = String(error.message)
        return interaction.reply({ embeds: [WarningEmbed("You can't use this command right now.", joinableError)], ephemeral: true })

    }

    let seekTime; let altered = false
    if (mode === 'rw') { seekTime = parseInt((queue.players.music.currentResource.playbackDuration / 1000)?.toFixed()) - 15 }
    else if (mode === 'ff') { seekTime = parseInt((queue.players.music.currentResource.playbackDuration / 1000)?.toFixed()) + 15 }
    if (seekTime > queue.songs.current.durationInSec) {
        queue.skip()
        altered = true
    }
    if (seekTime < 1) {
        seekTime = 0
    }

    try { queue.songs.current.ffmpeg(seekTime) } catch (err) { log('FFmpeg Seek Error', err)}
    
    return interaction.reply({ embeds: [CreateEmbed(mode === 'ff' ? 'Seeked ahead 15 seconds.' : 'Seeked backwards 15 seconds.', `${altered ? 'Skipped to the next song because the previous song had less than 15 seconds remaining.' : 'Time-Synced features like Flowing Lyrics will automatically update their positions.'}`, 'Playback Controls', interaction.member) ] })
    
}

export { command, commandData, execute }