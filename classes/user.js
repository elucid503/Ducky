'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import fs from 'fs'
import Spotify from 'spotify-web-api-node'
import { playlist, soundboard } from './playlist.js'
import { writeableSong } from './song.js'
import { log, wordChoice } from '../functions/misc.js'
import { checkSpToken } from '../functions/sources.js'
import { CreateEmbed } from '../functions/interface.js'
import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';
import { getExistingDBEntry, createDBEntry, updateDBEntry, overwriteDBEntry } from '../functions/data.js'

export async function getUser(userID, client) { 

    let existingUsr = await getExistingDBEntry(userID); let usr;
    usr = await client.users.fetch(userID); if (!usr) { throw new Error('Could not resolve this user from the client cache.'); }
    let resolvedUsr = new user(existingUsr, usr)
    if (resolvedUsr.error) { throw new Error(resolvedUsr.error) }
    if (!existingUsr) { await resolvedUsr.createEntry() }
    return resolvedUsr

}

export default class user {

    constructor(existingUsr = false, discordUser) {

        if (!existingUsr && !discordUser) { return this.error = true }

        let developers = process.meta.config.lists.developers
        let blacklist = process.meta.config.lists.blacklistedUsers

        this.discordID = existingUsr?.discordID || discordUser.id
        this.developer = developers.includes(discordUser?.id || existingUsr?.discordID)
        this.blacklisted = blacklist.includes(discordUser?.id || existingUsr?.discordID)
        this.searchHistory = existingUsr?.searchHistory || []
        this.stats = existingUsr?.stats || { favoriteSong: null, favoriteArtist: null, commandsRan: 0, songsQueued: 0 }
        this.library = existingUsr?.library || { songs: [], artists: [], playlists: [], spotify: [] }
        this.history = existingUsr?.history || new Array()
        this.settings = existingUsr?.settings || { stealth: false, notifications: true }
        this.cooldowns = existingUsr?.cooldowns || []
        this.inbox = existingUsr?.inbox || { notifications: [], alerts: [], outages: [] }
        this.connections = existingUsr?.connections || { discord: { access_token: null, refresh_token: null, expiry: null }, spotify: { access_token: null, refresh_token: null, expiry: null } }
        this.ctas = existingUsr?.ctas || { play: true, lyrics: true, library: true, modes: true, flyrics: true, soundboard: true  }
        this.soundboard = existingUsr.soundboard || new soundboard()
        this.firstCreated = false

    }

    checkCTA(type = 'play') {
        
        let status = this.ctas[type]

        if (status === false) {
            return false
        }

        this.ctas[type] = false
        this.save()
        return true 

    }

    getCTA(type = 'play') { 

        const ctas = { 
            'play': {
                title: `Get started with Ducky's advanced user-interface.`,
                description: `Use <:pause:${process.meta.config.botSettings.buttons.main.pause}> to pause the song. The button will change to <:play:${process.meta.config.botSettings.buttons.main.play}>
                Use <:dc2:${process.meta.config.botSettings.buttons.dc2}> to disconnect Ducky. The queue's upcoming songs will be saved.
                Use <:last:${process.meta.config.botSettings.buttons.last}> to skip to the previous song. That song will instantly play.
                Use <:next:${process.meta.config.botSettings.buttons.next}> to go to the next song. That song will instantly play.
                Use <:loop:${process.meta.config.botSettings.buttons.loops.sentry}> to toggle loop modes. The button will cycle through <:songloop:${process.meta.config.botSettings.buttons.loops.currentSong}> and <:currentSong:${process.meta.config.botSettings.buttons.loops.entireQueue}>
                Use <:ff:${process.meta.config.botSettings.buttons.ff}> to skip forward 10 seconds. The song should instantly fast forward.
                Use <:lyrics:${process.meta.config.botSettings.buttons.lyrics}> to view Flowing Lyrics. The lyrics will update with each verse.
                Use <:save:${process.meta.config.botSettings.buttons.save}> to add a song to your liked songs. You can also add it to a playlist.
                Use <:lyrics:${process.meta.config.botSettings.buttons.queue}> to view the queue. To edit the queue, use \`/queue\`
                Use <:normal:${process.meta.config.botSettings.buttons.switchMode.normal}> to switch modes. You'll see more info when you first use it.

                When adding songs to the queue, you can also use: 

                <:remove:1024086708490346597> to remove the song from the upcoming queue.
                <:info:${process.meta.config.botSettings.buttons.info}> to view info on the song.
                <:skipto:${process.meta.config.botSettings.buttons.skipTo}> to jump to the song instantly.
                
                During playback, also try out:

                \`/effect\` to apply customized effects on the song. 
                \`/current\` to view background info on the song. 
                \`/say\` to synthesize and speak a message in your call.
                
                Next to the title:

                <:remembered:${process.meta.config.botSettings.buttons.cached}> means the song has been played before and is cached.
                    
                Cached tracks can speed up loading time.`
            },
            'lyrics': {
                title: `Get started with Ducky's Interactive Lyrics.`,
                description: `Similar to Flowing Lyrics, Interactive Lyrics takes it to the next level.
                Skip to a verse, rewind to your favorite lyric, and see everything in advance.

                Use the buttons shown below to seek and skip to different lines.

                Use <:return:${process.meta.config.botSettings.buttons.reset}> to return to the current verse. 
                Use <:up:${process.meta.config.botSettings.buttons.up}> to go up, if available. 
                Use <:down:${process.meta.config.botSettings.buttons.down}> to go down, if available. 
                Use <:next:${process.meta.config.botSettings.buttons.next}> to go to the selected verse.

                Before and after all lyrics are sung, you'll see the song's artists.`    
            },
            'flyrics': {
                title: `Get started with Ducky's Flowing Lyrics.`,
                description: `Unlike other bots, Ducky takes lyrics seriously.
                Just like in Spotify or Apple Music, you'll see lyrics update in real time.

                Ducky calculates the time of the song by keeping track of individual audio bytes.
                It's overkill, but no matter what happens, your lyrics will stay synced.

                The **last** line sung will display **below** the current verse.
                The **next** line to be sung will display **above** the current verse.

                To prevent abuse, only allows one lyric request per song. 
                If you accidently delete the lyric message, don't worry.
                Just wait a few seconds for the next verse to use the <:lyrics:${process.meta.config.botSettings.buttons.lyrics}> button again.

                Use \`/lyrics\` for Interactive Lyrics - an entirely different and unique experience!`    
            },

            'library': {
                title: `Get started with your liked songs and custom playlists.`,
                description: `Ducky allows you to save songs to your liked songs library, as well as create, manage and enqueue as many custom playlists as you want.
                
                To get started with your library, use the buttons shown below.
                
                Use <:return:${process.meta.config.botSettings.buttons.reset}> to return to the first page. 
                Use <:backalt:1042216548028395590> to go back a page. 
                Use <:nextPage:${process.meta.config.botSettings.buttons.nextPage}> to go forward a page. 
                Use <:up:${process.meta.config.botSettings.buttons.up}> to go up, if available. 
                Use <:down:${process.meta.config.botSettings.buttons.down}> to go down, if available. 
                Use <:add:${process.meta.config.botSettings.buttons.addToQueue}> to create a new playlist or enqueue a song. 
                Use <:rm:1040787625633661001> to remove a song or playlist. 
                Use <:rm:${process.meta.config.botSettings.buttons.info}> to view song info, or a playlist's songs. 
                
                You can also sync your public Spotify playlists using \`/sync\``
            },
            'modes': {
                title: `Get started with Ducky's audio modes.`,
                description: `Ducky offers three different audio modes to enhance playback.

                **Normal Mode** is the default mode, with no added effects or audio features.
                **Dynamic Mode** adaptively transforms the volume to user's conversations.
                **Enhanced Mode** (beta) immerses you in the audio with virtual speakers.

                <:normal:${process.meta.config.botSettings.buttons.switchMode.normal}> indicates the Normal Mode is active.
                <:dynamic:${process.meta.config.botSettings.buttons.switchMode.dynamic}> indicates Dynamic Mode is active.
                <:spatial:${process.meta.config.botSettings.buttons.switchMode.spatial}> indicates Enhanced Mode is active.`
            },

            'soundboard': {
                title: `Play some sounds!`,
                description: `The soundboard is a great way to have some fun.

                You can play your own custom effects in your call.
                The effects default to the classics, however you can customize them. 

                The soundboard acts as a queue.
                Older effects may play first.
                
                Use <:play:${process.meta.config.botSettings.buttons.main.play}> to play the effect in this slot.
                Use <:settings:${process.meta.config.botSettings.buttons.settings}> to edit the effect in this slot.

                Effects may be added by YouTube video URLs. 
                Effects must not be over 10 seconds long.`
            },
        }

        let embed = CreateEmbed(ctas[type].title, ctas[type].description, 'First-Time Tips', false, '1cfaa4', false, 'This message will only pop up here this one time.\nYou can view it again at any time with /help', true)
        return embed 

    }

    addSongToLibrary(song) { 

        let writableSong = new writeableSong(song) 

        this.library.songs.push(writableSong)

        this.updateEntry('library', this.library)

        return this.library.songs.length || 0 // returns new amount of saved songs (INT)

    }

    addResolvedPlaylist(resolvedPlaylist) { 

        this.library.playlists.push(resolvedPlaylist)

        this.updateEntry('library', this.library)

        return this.library.playlists.length || 0 // returns new amount of saved playlists (INT)

    }

    removeSongFromLibrary(internalId) { 

        let toRemove = this.library?.songs?.find((song => song._internalId === internalId))
        if (!toRemove) { return this.library?.songs?.length }

        this.library?.songs.splice(this?.library?.songs.indexOf(toRemove), 1)
        this.updateEntry('library', this.library)

        return this.library.songs.length || 0 // returns new amount of saved songs (INT)

    }


    createEntry() { this.firstCreated = true; createDBEntry(this) } 

    updateEntry(key, value) {
        this[key] = value; try { updateDBEntry(this.discordID, key, value) } catch { }
    }

    save(user) { overwriteDBEntry(user || this) }

    increment(type = 2, value = null) {

        let stats = { 0: 'favoriteSong', 1: 'favoriteArtist', 2: 'commandsRan', 3: 'songsQueued' }
        let key = stats[type]
        if (value) this.stats[key] = value
        else { this.stats[key] += 1 } 
        this.save()

        return true 

     }

    checkCooldown(command) {
        
        let isActive = false; let expiry = false 
        for (const cooldown of this.cooldowns) { if (cooldown.expiry <= Math.floor(new Date().getTime() / 1000)) { this.cooldowns.splice(cooldown, 1) } }
        this.updateEntry('cooldowns', this.cooldowns)
        for (const cooldown of this.cooldowns) { if (cooldown.command === command) { isActive = true; expiry = cooldown.expiry } }
 
        if (isActive) { return { isActive: true, expiry: expiry } }
        else return { isActive: false, expiry: false }

    }

    addCooldown(command, time) { 

        if (this.developer && process.meta.config.misc.ignoreDevCooldowns) { return true }
        try { this.cooldowns.push({ command: command, expiry: (Math.floor(new Date().getTime() / 1000) + time) }) 
        this.updateEntry('cooldowns', this.cooldowns) } catch (err) { log('Cooldown Save Error', err); return false }

        return true 

    } 

    addToInbox(type = 0, title, message = 'No description was provided for this message.', image = false) { 

        const types = { 0: { name: 'Notification', color: '20b9e8', backend: 'notifications' }, 1: { name: 'Alert', color: 'e8b620', backend: 'alerts' }, 2: { name: 'Outage', color: 'e83120', backend: 'outages' } }

        const RichEmbed = new EmbedBuilder()

        RichEmbed.setAuthor({ name: `New ${types[type].name}` })
        RichEmbed.setTitle(title)
        RichEmbed.setDescription(message)
        RichEmbed.setColor(types[type].color)
        RichEmbed.setFooter({ iconURL: process.meta.config.botSettings.styles.footer.icon, text: `${process.meta.config.botSettings.styles.footer.text}\nThis ${types[type].name.toLowerCase()} has automatically been marked as read.` })

        if (image) RichEmbed.setImage(image)

        const notification = new Object()

        notification.embed = RichEmbed.toJSON()
        notification.type = type

        try { this.inbox[types[type].backend].push(notification)
        this.save() } catch (err) { log('Notification Save Error', err); return false }

        return true 

    }

    displayNotifications(interaction) {

        if (!this.settings.notifications) { return }

        const allNotifications = [...this.inbox.notifications, ...this.inbox.alerts, ...this.inbox.outages]
        const allEmbeds = []; for (const notification of allNotifications) { allEmbeds.push(new EmbedBuilder(notification.embed)) }

        const inbox = this.inbox

        if (allNotifications.length === 0) { return }

        let page = 0;

        let replyCheck = setInterval(async () => {
            
            if (interaction.replied) {
                clearInterval(replyCheck);
        
                const types = { 0: { name: 'Notification', color: '20b9e8', backend: 'notifications' }, 1: { name: 'Alert', color: 'e8b620', backend: 'alerts' }, 2: { name: 'Outage', color: 'e83120', backend: 'outages' } }

                const buttonRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('view').setStyle(ButtonStyle.Primary).setLabel('View')).addComponents(new ButtonBuilder().setCustomId('disable').setStyle(ButtonStyle.Danger).setLabel('Disable Notifications'))
                let message = await interaction.followUp({ embeds: [ CreateEmbed(`You have ${allNotifications.length} unread ${wordChoice(allNotifications.length, 'notification')}`, `${inbox.notifications.length} ${wordChoice(inbox.notifications.length, 'Message')} • ${inbox.alerts.length} ${wordChoice(inbox.alerts.length, 'Alert')} • ${inbox.outages.length} ${wordChoice(inbox.outages.length, 'Outage')}`, `Your Inbox`, interaction.member) ], ephemeral: true, components: [ buttonRow ] })
    
                const collector = message.createMessageComponentCollector({ dispose: true })
                collector.on('collect', async (childInteraction) => { 

                    try { await childInteraction.deferUpdate({ ephemeral: true }) } catch(err) { return log('Defer Error', err )}
    
                    if (childInteraction.customId === 'disable') { 
    
                        this.settings.notifications = false
                        this.save()
    
                        await childInteraction.editReply({ embeds: [ CreateEmbed(`You will no longer receive notifications`, `If you re-enable notifications, you'll still be able to view what you missed.`, `Settings Management`, interaction.member) ], components: [], ephemeral: true, })
    
                    }
    
                    if (childInteraction.customId === 'view') { 
                        await childInteraction.editReply({ embeds: [allEmbeds[page]], components: [getNavigateRow(page)], ephemeral: true }).catch(() => {})
                        this.inbox[types[allNotifications[page]?.type]?.backend]?.splice(this.inbox[types[allNotifications[page].type].backend].indexOf(allNotifications[page]), 1)
                        this.save()
    
                    }
    
                    if (childInteraction.customId === 'next') { 
    
                        page++
                        await childInteraction.editReply({ embeds: [allEmbeds[page]], components: [getNavigateRow(page)], ephemeral: true }).catch(() => {})
                        this.inbox[types[allNotifications[page]?.type]?.backend]?.splice(this.inbox[types[allNotifications[page].type].backend].indexOf(allNotifications[page]), 1)
                        this.save()
    
                    }
    
                    if (childInteraction.customId === 'last') { 
    
                        page--
                        await childInteraction.editReply({ embeds: [allEmbeds[page]], components: [getNavigateRow(page)], ephemeral: true }).catch(() => {})
                        this.inbox[types[allNotifications[page]?.type]?.backend]?.splice(this.inbox[types[allNotifications[page].type].backend].indexOf(allNotifications[page]), 1)
                        this.save()
    
                    }
    
                })
        
            }

        }, 100)

        function getNavigateRow(page) {

            let forwardDisabled = true; let backDisabled = true
            
            if (allEmbeds.length > 1 && page !== allEmbeds.length - 1) { forwardDisabled = false }
            if (page !== 0) { backDisabled = false }
            
            return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('last').setStyle(ButtonStyle.Secondary).setLabel('< Last').setDisabled(backDisabled)).addComponents(new ButtonBuilder().setCustomId('next').setStyle(ButtonStyle.Secondary).setLabel('Next >').setDisabled(forwardDisabled))

        }

    }
}