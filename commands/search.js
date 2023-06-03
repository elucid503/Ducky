'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType, ActionRowBuilder, SelectMenuBuilder } from 'discord.js'
import { CreateEmbed, WarningEmbed, ErrorEmbed } from "../functions/interface.js"
import { log, formatDur, limit, checkJoinability } from '../functions/misc.js'
import { searchPlatform, convertSpToYt } from '../functions/sources.js'
import { getQueue } from '../classes/queue.js'
import { song } from '../classes/song.js'

const command = new Object()
command.name = 'search'
command.description = `More specifically search and add songs to the queue.`
command.options = [ { name: "search", description: 'Search a song by it\'s title and / or artist.', type: ApplicationCommandOptionType.String, required: true, min_length: 2, max_length: 100 } ]
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 0

async function execute(interaction, resolvedUser, discordClient) { 

    // this command is how to do pagination RIGHT - eventually queue, lib and playlist will inherit this

    const search = interaction.options.get('search').value
    let searchResponses = new Array(); let searchURL

    try { searchURL = new URL(search) } catch { }
    
    if (searchURL) { return interaction.reply({ embeds: [WarningEmbed('You cannot search using a URL.', `Use \`play\` to resolve links to songs.`)], ephemeral: true }) }  

    try { searchResponses = await searchPlatform(search, { spotify: 'track' }, 10) } catch (err) { log('Search Error', err) }
    if (!searchResponses || searchResponses?.length < 1) { return interaction.reply({ embeds: [WarningEmbed('No results could be found for this search.', `Please try a different search, or [contact support](${process.meta.config.misc.links.support}) if this continues.`)], ephemeral: true })}
 
    function getDescription() { 

        let description = new Array()
        let count = 0
        
        for (const result of searchResponses) { 

            description.push(`[${result.name}](${result.url}) • ${result.artists[0].name}, ${formatDur(result.durationInSec)} min`)
            count += 1

        }

        return description.join('\n\n')
 
    }

    function getComponents() { 

        let options = new Array()
        let count = 0
        
        for (const result of searchResponses) { 

            options.push({ label: limit(result.name, 95), description: limit(`by ${result.artists[0].name}; on ${result.album?.name || result.name}`, 95), value: count.toString() })
            count += 1

        }

        const component = new ActionRowBuilder().addComponents(new SelectMenuBuilder().setOptions(options).setCustomId('select').setPlaceholder('Choose a song from above.'))
        return [component]
 
    }

    interaction.reply({ embeds: [CreateEmbed(`Songs matching "${search}"`, getDescription(), 'Song Searching', interaction.member)], ephemeral: true, components: getComponents() }).then((msg) => { handleComponents(msg) }).catch((err) => { log('Interaction Error', err)})

    function handleComponents(msg) { 
        
        let collector = msg.createMessageComponentCollector({ time: 3600000 })

        collector.on('collect', async (childInt) => {

            let id = childInt.customId
            await childInt.deferUpdate().catch((err) => { log('Button Defer Error', err) })

            if (id === 'select') {

                let selected = childInt.values[0]

                let selectedSpSong = searchResponses[parseInt(selected)]

                let queue = process.meta.queues.get(interaction.guild.id)
                if (!queue) {
                
                    try { await checkJoinability(interaction.member, interaction.guild, 0) } catch (error) {

                        let joinableError = String(error.message)
                        return childInt.followUp({ embeds: [WarningEmbed("You can't play this song right now.", joinableError)], ephemeral: true })
                
                    }
                
                    try {
                        queue = await getQueue(interaction.guild.id, interaction.member.voice.channel, interaction.channel, discordClient)
                    } catch (err) {
                        log('Queue Creation Error', err)
                        childInt.followUp({ embeds: [ErrorEmbed("This server's queue is not fetchable.", `Something prevented Ducky from getting a queue for this server.\nPlease [contact support](${process.meta.support}) if this continues.`)], components: [], ephemeral: true })
                        return
                    }
                
                    if (!interaction.guild.members?.me?.voice?.channel?.id) {
                        try { queue.connect() } catch (err) {
                            log('Connection Error', err)
                            childInt.followUp({ embeds: [ErrorEmbed("Ducky could not connect to your call.", `Something prevented Ducky from connecting to your call.\nPlease [contact support](${process.meta.support}) if this continues.`)], components: [], ephemeral: true })
                            return
                        }
                    }
                }

                let ytResult
                try { ytResult = await convertSpToYt(selectedSpSong) } catch (err) { log('Conversion Error', err) }
                if (!ytResult) { return childInt.followUp({ embeds: [ErrorEmbed("Ducky could not properly play this song.", `This song could not be converted to the correct format.\nPlease [contact support](${process.meta.support}) if this continues.`)], components: [], ephemeral: true }) }

                let resolvedSong = new song(null, interaction.member, interaction.channel, search, {}, ytResult, selectedSpSong) // give as much data as possible

                let posResp = queue.add(resolvedSong)
                queue.update()

                let channel = queue.textChannel || interaction.channel
                channel.send({ embeds: [resolvedSong.getEmbed(true)], components: queue.getPlayButtons(resolvedSong) }).then((msg) => { if (msg) queue.handleStdButtonIds(msg, resolvedSong) }).catch((err) => { })

                if (posResp === 0) {
                    try { await queue.play(0) } catch (err) {
                        log('Play / Resource Error', err)
                        childInt.followUp({ embeds: [ErrorEmbed("Ducky could not play this song.", err.message)], components: [], ephemeral: true }).catch(() => { })
                        queue.remove(resolvedSong)
                        return
                    }
                }

            }

        })

    }
    
}

export { command, commandData, execute }