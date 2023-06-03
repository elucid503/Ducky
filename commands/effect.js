'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType  } from 'discord.js'
import { CreateEmbed, WarningEmbed, ErrorEmbed } from "../functions/interface.js";
import { checkUsability } from '../functions/misc.js'
import { log } from '../functions/misc.js'

const command = new Object()
command.name = 'effect'
command.description = `Add custom effects to the song playing in the queue.`
command.options = [ { name: "effect", description: 'Choose an effect to apply to the current song.', choices: [ { name: "Disable All", value: "disable" }, { name: "Rotate Audio", value: "rotate" },  { name: "Slow Down", value: "slowdown" }, { name: "Speed Up", value: "speedup" }, { name: "Bass Boost", value: "bass" }, { name: "Intensify Chorus", value: "chorus" }, { name: "Desilencer", value: "desilencer" }, { name: "Karaoke", value: "karaoke" }  ], type: ApplicationCommandOptionType.String, required: true }  ]
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 15

async function execute(interaction, resolvedUser, discordClient) { 

    let queue = process.meta.queues.get(interaction.guild.id)
    if (!queue) { return interaction.reply({ embeds: [WarningEmbed("Ducky is not playing anything in this server.", `To view information on the current song, join a voice channel and play a song first.`)], components: [], ephemeral: true }).catch(() => {})  }
    if (!queue.songs.current) { return interaction.reply({ embeds: [WarningEmbed("There is no song currently playing.", `To change effects, a song must be playing first.`)], components: [], ephemeral: true }).catch(() => { }) }

    if (!queue.songs.current.type === 'arbitrary') { return interaction.reply({ embeds: [WarningEmbed("Effects are currently unavailable.", `Effects are unavailable on songs from outside/unknown sources.`)], components: [], ephemeral: true }).catch(() => { }) }
    
    try { await checkUsability(interaction.member, interaction.guild) } catch (error) { 

        let joinableError = String(error.message)
        return interaction.reply({ embeds: [WarningEmbed("You can't use this command right now.", joinableError)], ephemeral: true })

    }

    if (queue.modes.spatial) { return interaction.reply({ embeds: [WarningEmbed("Effects are currently unavailable.", `Enhanced Audio is enabled, and effects cannot be enabled until it is disabled.`)], components: [], ephemeral: true }).catch(() => { }) }

    const effect = queue.availableEffects[interaction.options.get('effect').value] || { backend: 'disable' }

    const effectArgs = { 

        rotate: [  '-af', 'apulsator=hz=0.12,dynaudnorm=f=200 ' ],
        
        speedup: [  '-af', 'aresample=48000,asetrate=48000*1.25' ],
        
        slowdown: [  '-af', 'aresample=48000,asetrate=48000*0.85' ], 

        bass: [  '-af', 'bass=g=8,dynaudnorm=f=200'], 
        
        chorus: [   '-af', 'chorus=0.5:0.9:50|60|40:0.4|0.32|0.3:0.25|0.4|0.3:2|2.3|1.3,dynaudnorm=f=200'],
        
        desilencer: [  '-af', 'silenceremove=window=0:detection=peak:stop_mode=all:start_mode=all:stop_periods=-1:stop_threshold=0,dynaudnorm=f=200' ],

        karaoke: [  '-af', 'stereotools=mlev=0.03,dynaudnorm=f=200' ]

    }

    if (effect.backend === 'disable') { 

        queue.effects.applied = false
        queue.update()
        
        queue.songs.current.ffmpeg().catch((err) => {

            log('Queue FFmpeg Error', err)
            return interaction.reply({ embeds: [ErrorEmbed("This song could not be reset.", `This may be due to the format being unsupported.\nFilters are unavailable when playing via Ducky's external media extractor.`)], components: [], ephemeral: true }).catch(() => { })

        })

        return interaction.reply({ embeds: [CreateEmbed('Disabled effects for the current song.', `The original version of this song will now resume.`, 'Effects and Modes', interaction.member) ] })

    }

    else { 

        queue.effects.applied = true 
        queue.update()

        queue.songs.current.ffmpeg(false, effectArgs[effect.backend]).catch((err) => {

            log('Queue FFmpeg Error', err)
            return interaction.reply({ embeds: [ErrorEmbed("This filter could not be applied.", `This may be due to the format being unsupported.\nFilters are unavailable when playing via Ducky's external media extractor.`)], components: [], ephemeral: true }).catch(() => { })

        })

        let title = `Enabled "${effect.name}"`
        if (queue.effects.applied) { title = `Switched to "${effect.name}"` }

        return interaction.reply({ embeds: [CreateEmbed(title, effect.description, 'Effects and Modes', interaction.member) ] }).catch((err) => { })

    }
    
}

export { command, commandData, execute }