'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js'
import { checkJoinability, log, wordChoice } from '../functions/misc.js'
import { WarningEmbed, ErrorEmbed } from "../functions/interface.js"
import { searchForSong } from '../functions/sources.js'
import { getQueue } from '../classes/queue.js'
import { writeableSong } from '../classes/song.js';

const command = new Object()
command.name = 'play'
command.description = `Play songs, albums, URLs and audio files in your call.`
command.options = [ { name: "search", description: 'Accepts text searches, music and media platform URLs or raw audio links.', type: ApplicationCommandOptionType.String, required: true }, { name: "platform", description: 'Force-search a specific platform. Search results may be inconsistent.', choices: [  { name: 'Spotify', value: '0' }, { name: 'SoundCloud', value: '1' }, { name: 'YouTube', value: '2' } ], type: ApplicationCommandOptionType.String, required: false }  ]
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 2

async function execute(interaction, resolvedUser, discordClient) { 
    
    const search = interaction.options.get('search').value
    const platform = parseInt(interaction.options.get('platform')?.value) || 0
    let queue; let song; let posResp;

    try { await checkJoinability(interaction.member, interaction.guild, 0) } catch (error) { 

        let joinableError = String(error.message)
        return interaction.reply({ embeds: [WarningEmbed("You can't use this command right now.", joinableError)], ephemeral: true })

    }

    try {
        queue = await getQueue(interaction.guild.id, interaction.member.voice.channel, interaction.channel, discordClient)
    } catch (err) {
        log('Queue Creation Error', err)
        if (interaction.replied) interaction.editReply({ embeds:[ ErrorEmbed("This server's queue is not fetchable.", `Something prevented Ducky from getting a queue for this server.\nPlease [contact support](${process.meta.support}) if this continues.`)], components: [] })
        else interaction.reply({ embeds: [ErrorEmbed("This server's queue is not fetchable.", `Something prevented Ducky from getting a queue for this server.\nPlease [contact support](${process.meta.support}) if this continues.`)], components: [], ephemeral: true })
        return
    }

    if (!interaction.guild.members?.me?.voice?.channel?.id) {
        try { await queue.connect() } catch (err) {
            log('Connection Error', err)
            if (interaction.replied) interaction.editReply({ embeds: [ErrorEmbed("Ducky could not connect to your call.", `Something prevented Ducky from connecting to your call.\nPlease [contact support](${process.meta.support}) if this continues.`)], components: [] })
            else interaction.reply({ embeds: [ErrorEmbed("Ducky could not connect to your call.", `Something prevented Ducky from connecting to your call.\nPlease [contact support](${process.meta.support}) if this continues.`)], components: [], ephemeral: true })
            return
        }
    }

    try {
        
            song = await searchForSong(search, platform, interaction.member, interaction.channel, queue)
    
            posResp = queue.add(song)
            queue.update()
            
            try { const writable = new writeableSong(song)
            writable.addToUserHistory(resolvedUser) } catch { }
        

    } catch (err) {
        
        log('Search Error', err)
        if (interaction.replied) interaction.editReply({ embeds: [ErrorEmbed("Ducky could not find that song.", err.message)], components: [] })
        else interaction.reply({ embeds: [ErrorEmbed("Ducky could not find that song.", err.message)], components: [], ephemeral: true }).catch((originalErr) => { interaction.editReply({ embeds: [ErrorEmbed("Ducky could not find that song.", err.message)], components: [], ephemeral: true }).catch((err) => { }) })
        return
    }

    if (!song) { 
        if (interaction.replied) interaction.editReply({ embeds: [ErrorEmbed("Ducky could not find that song.", `A song matching your search could not be found.\nPlease [contact support](${process.meta.config.misc.links.support}) if this error persists.`)], components: [] })
        else interaction.reply({ embeds: [ErrorEmbed("Ducky could not find that song.", `A song matching your search could not be found.\nPlease [contact support](${process.meta.config.misc.links.support}) if this error persists.`)], components: [], ephemeral: true })
        return
    }
    
    interaction.reply({ embeds: [song.getEmbed(true)], components: queue.getPlayButtons(song) }).then((msg) => {
        if (msg)
            queue.handleStdButtonIds(msg, song); if (song.meta.playlist.part) { queue.syncedPlaylistEmbeds[song.meta.playlist.url].message = msg; queue.syncedPlaylistEmbeds[song.meta.playlist.url].count = 0 }
            if (resolvedUser.checkCTA('play')) { 
                interaction.followUp({ embeds: [resolvedUser.getCTA('play')], ephemeral: true }).catch( async (err) => {
                    log("CTA Error", err)
                })
            }
    }).catch(async (err) => {  
        interaction.editReply({ embeds: [song.getEmbed(true)], components: queue.getPlayButtons(song) }).then((msg) => {
            if (msg) queue.handleStdButtonIds(msg, song); if (song.meta.playlist.part) { queue.syncedPlaylistEmbeds[song.meta.playlist.url].message = msg; queue.syncedPlaylistEmbeds[song.meta.playlist.url].count = 0 }
            if (resolvedUser.checkCTA('play')) { 
                interaction.followUp({ embeds: [resolvedUser.getCTA('play')], ephemeral: true }).catch( async (err) => {
                    log("CTA Error", err)
                })
            }
        }).catch((err) => { })
    })

    if (posResp === 0) {
        try { await queue.play(0) } catch (err) {
            log('Play / Resource Error', err)
            interaction.reply({ embeds: [ErrorEmbed("Ducky could not play this song.", err.message)], components: [], ephemeral: true }).catch(() => { interaction.editReply({ embeds: [ErrorEmbed("Ducky could not play this song.", err.message)], components: [] }).catch(() => {}) }) 
            queue.remove(song)
            return
        }
    }

}

async function execute_voice(args, queue, user) { 

    let posResp = null; let song

    if (!args) { return queue.speak('Please say a query to search for a song.') }

    try { 

        song = await searchForSong(args, 0, user, queue.textChannel, queue)

        posResp = queue.add(song)
        queue.update()

    } catch (err) {
    
        log('Search Error', err)
        return await queue.speak(`Sorry, but that song could not be found.`)
        
    }

    if (!song) { return await queue.speak(`Sorry, but that song could not be found.`) }

    if (posResp === 0) {
        try { await queue.play(0) } catch (err) {
            log('Play / Resource Error', err)
            await queue.speak('Sorry, but this song could not be played and had to be removed.')
            queue.remove(song)
            return
        }
        song.meta.voice = true  
        await queue.speak(`Now playing ${song.titles.display.normal} by ${song.artists[0]}`)
        queue.textChannel.send({ embeds: [ song.getEmbed()], components: queue.getPlayButtons(song) }).then((msg) => { queue.handleStdButtonIds(msg, song) }).catch((err) => { log("Interaction Error", err)})
    }

    else { 

        await queue.speak(`${song.titles.display.normal} is ${posResp} ${wordChoice(posResp, 'song')} away in the queue.`)
        queue.textChannel.send({ embeds: [ song.getEmbed()], components: queue.getPlayButtons(song) }).then((msg) => { queue.handleStdButtonIds(msg, song) }).catch((err) => { log("Interaction Error", err)})

    }
    
} 

export { command, commandData, execute, execute_voice }
