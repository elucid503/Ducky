'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType  } from 'discord.js'
import { CreateEmbed, WarningEmbed } from "../functions/interface.js"
import { log, limit } from '../functions/misc.js'

const command = new Object()
command.name = 'artist'
command.description = `View information on the artist of the current song.`
command.options = [ /* COMING SOON (hopefully) { name: "search", description: 'Optionally search for an artist by their name or profile URL.', type: ApplicationCommandOptionType.String, required: false } */ ]
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 5

async function execute(interaction, resolvedUser, discordClient) { 

    let queue = process.meta.queues.get(interaction.guild.id)
    if (!queue) { return interaction.reply({ embeds: [WarningEmbed("Ducky is not playing anything in this server.", `To view artist information on the current song, join a voice channel and play a song first.`)], components: [], ephemeral: true }).catch(() => {})  }
    if (!queue.songs.current) { return interaction.reply({ embeds: [WarningEmbed("There is no song currently playing.", `To view artist information on the current song, a song must be playing first.`)], components: [], ephemeral: true }).catch(() => { }) }

    let artistDetails;

    try { artistDetails = await queue.songs.current.getAristDetails() } catch (err) { log('Artist Fetch Err', err) }

    if (!artistDetails) { return interaction.reply({embeds: [ WarningEmbed('Artist details for this song could not be found.', 'We\'re actively including new data sources to make artist discovery more reliable.')], ephemeral: true }).catch((err) => { })}

    const compiledTopSongs = new Array() 
    let count = 1
    for (const song of artistDetails.topSongs) { 

        if (count > 4) { break }
        compiledTopSongs.push(`[${song.title} • ${song.released}](${song.url})`)

        count += 1

    }

    const embed = CreateEmbed(artistDetails.name,
        limit(artistDetails.description, 725, `... [see more.](${artistDetails.url})\nㅤ`) || 'No artist description found.',
        `Artist Details`, interaction.member, null,
        [

            { name: 'Also Known As', value: `[${artistDetails.alternateNames[0] || 'No aliases found.'}](${artistDetails.url})\n[${artistDetails.alternateNames[1] || 'No other aliases found.'}](${artistDetails.url})\nㅤ`, inline: true },
            { name: 'Social Medias', value: `[Instagram](https://instagram.com/${artistDetails.socials.insta})\n[Twitter](https://twitter.com/${artistDetails.socials.twitter})\nㅤ`, inline: true },
            { name: 'Most Known Songs', value: compiledTopSongs.join('\n') + '\nㅤ', inline: false },

        ],
        'Provided by Genius',
        false, { thumbnail: artistDetails.squareImg, url: artistDetails.url || queue.songs.current.urls.duckyURL }
    )

    interaction.reply({ embeds: [ embed] }).catch((err) => { log('Reply Error', err) })

}

export { command, commandData, execute }