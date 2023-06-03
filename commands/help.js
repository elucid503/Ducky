'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { ApplicationCommandType, ApplicationCommandOptionType  } from 'discord.js'
import { CreateEmbed } from "../functions/interface.js"
import { log } from "../functions/misc.js"

const command = new Object()
command.name = 'help'
command.description = `View helpful information on how to use Ducky and it's features.`
command.options = [ { name: "guide", description: 'Choose which guide to view and interact with.', choices: [  { name: 'Main Interface', value: 'play' }, { name: 'Flowing Lyrics', value: 'flyrics' }, { name: 'Interactive Lyrics', value: 'lyrics' },  { name: 'Library UI', value: 'library' }, { name: 'Audio Modes', value: 'modes' }, { name: 'Voice Interactions', value: 'voiceint' }, { name: 'Soundboard', value: 'sb' } ], type: ApplicationCommandOptionType.String, required: true }  ]
command.type = ApplicationCommandType.ChatInput

const commandData = new Object()
commandData.private = false
commandData.restricted = false
commandData.cooldown = 0

const ctas = {

    'voiceint': {

        title: `Control Ducky with just your voice.`,
        description: `When in a call and available, Ducky securely listens and processes what you say. This data is never used for any other purposes than listening for the \`music\` keyword.
        
        Upon using the \`music\` keyword, you can interact with Ducky using just your voice.
        Say the phrases below clearly and concisely for Ducky to hear and execute your requests:
        
        \`music play <search>\` • Play any song in your call.
        \`music pause\` • Pause the current audio playing.
        \`music resume\` • Resume any audio that is paused.
        \`music next\` • Skip to the next song playing, if any.
        \`music last\` • Skip to the last song playing, if any.
        \`music save\` • Save the current song to your library.
        \`music lyrics\` • Get Flowing Lyrics for the current song.
        \`music loop\` • Toggle though the song / queue loop modes.
        \`music autoplay\` • Toggle autoplay for the current server.
        \`music stop\` • Stop the queue, removing all songs.
        \`music leave\` • Easily disconnect Ducky from the call.
        
        \`music help\` • View this message whenever you want.

        Voice Interactions are currently in early beta.
        More commands and features will be added soon.`
    },

    'play': {
        title: `Learn all about the main interface on /play`,
        description: `Use <:pause:${process.meta.config.botSettings.buttons.main.pause}> to pause a song. The button will change to <:play:${process.meta.config.botSettings.buttons.main.play}>
        Use <:dc2:${process.meta.config.botSettings.buttons.dc2}> to disconnect Ducky. The queue's upcoming songs will be saved.
        Use <:last:${process.meta.config.botSettings.buttons.last}> to skip to a previous song. That song will instantly play.
        Use <:next:${process.meta.config.botSettings.buttons.next}> to go to a next song. That song will instantly play.
        Use <:loop:${process.meta.config.botSettings.buttons.loops.sentry}> to toggle loop modes. The button will cycle through <:songloop:${process.meta.config.botSettings.buttons.loops.currentSong}> and <:currentSong:${process.meta.config.botSettings.buttons.loops.entireQueue}>
        Use <:ff:${process.meta.config.botSettings.buttons.ff}> to skip forward 10 seconds. The song playing should instantly fast forward.
        Use <:lyrics:${process.meta.config.botSettings.buttons.lyrics}> to view Flowing Lyrics. The lyrics will update with each verse.
        Use <:save:${process.meta.config.botSettings.buttons.save}> to add a song to your liked songs. You can also add it to a playlist.
        Use <:lyrics:${process.meta.config.botSettings.buttons.queue}> to view the queue. To edit the queue, use \`/queue\`
        Use <:normal:${process.meta.config.botSettings.buttons.switchMode.normal}> to switch modes. You'll see more info when you first use it.

        When adding songs to the queue, you can also use: 

        <:remove:1024086708490346597> to remove a song from the upcoming queue.
        <:info:${process.meta.config.botSettings.buttons.info}> to view info on a song.
        <:skipto:${process.meta.config.botSettings.buttons.skipTo}> to jump to a song instantly.
        
        During playback, also try out:

        \`/effect\` to apply customized effects on the song.
        \`/current\` to view background info on the song.
        \`/say\` to synthesize and speak a message in your call.   
                     
        Next to the title:

        <:remembered:${process.meta.config.botSettings.buttons.cached}> means the song has been played before and is cached.
            
        Cached tracks can speed up loading time.`

    },
    'lyrics': {
        title: `Learn all about Ducky's Interactive Lyrics.`,
        description: `Similar to Flowing Lyrics, Interactive Lyrics takes it to the next level.
        Skip to a verse, rewind to your favorite lyric, and see everything in advance.

        Use the buttons given to seek and skip to different lines.

        Use <:return:${process.meta.config.botSettings.buttons.reset}> to return to the current verse. 
        Use <:up:${process.meta.config.botSettings.buttons.up}> to go up, if available. 
        Use <:down:${process.meta.config.botSettings.buttons.down}> to go down, if available. 
        Use <:next:${process.meta.config.botSettings.buttons.next}> to go to the selected verse.

        Before and after all lyrics are sung, you'll see the song's artists.`
    },
    'flyrics': {
        title: `Learn all about Ducky's Flowing Lyrics.`,
        description: `Unlike other bots, Ducky takes lyrics seriously.
        Just like in Spotify or Apple Music, you'll see lyrics update in real time.

        Ducky calculates the time of the song by keeping track of individual audio bytes.
        It's overkill, but no matter what happens, your lyrics will stay synced.

        The **last** line sung will display **below** the current verse.
        The **next** line to be sung will display **above** the current verse.

        To prevent abuse, only allows one lyric request per song. 
        If you accidently delete the lyric message, don't worry.
        Just wait a few seconds for the next verse to use the <:lyrics:${process.meta.config.botSettings.buttons.lyrics}> button again.

        Use \`/lyrics\` when a song is playing for Interactive Lyrics.`
    },

    'library': {
        title: `Get started with your liked songs and custom playlists.`,
        description: `Ducky allows you to save songs to your liked songs library, as well as create, manage and enqueue as many custom playlists as you want.
        
        To get started with your library, use the buttons given to navigate.
        
        Use <:return:${process.meta.config.botSettings.buttons.reset}> to return to the first page. 
        Use <:backalt:1042216548028395590> to go back a page. 
        Use <:nextPage:${process.meta.config.botSettings.buttons.nextPage}> to go forward a page. 
        Use <:up:${process.meta.config.botSettings.buttons.up}> to go up, if available. 
        Use <:down:${process.meta.config.botSettings.buttons.down}> to go down, if available. 
        Use <:add:${process.meta.config.botSettings.buttons.addToQueue}> to create a new playlist or enqueue a song. 
        Use <:rm:1040787625633661001> to remove a song or playlist. 
        Use <:rm:${process.meta.config.botSettings.buttons.info}> to view song info, or a playlist's songs. 
        
        You can sync your public Spotify playlists with \`/sync\``
    },
    'modes': {
        title: `Get started with Ducky's audio modes.`,
        description: `Ducky offers three different audio modes to enhance playback.

        **Normal Mode** is the default mode, with no added effects or audio features.
        **Dynamic Mode** adaptively transforms the volume to user's conversations.
        **Enhanced Mode** (beta) immerses you in the audio with virtual speakers.

        <:normal:${process.meta.config.botSettings.buttons.switchMode.normal}> indicates the Normal Mode is active.
        <:dynamic:${process.meta.config.botSettings.buttons.switchMode.dynamic}> indicates Dynamic Mode is active.
        <:spatial:${process.meta.config.botSettings.buttons.switchMode.spatial}> indicates Enhanced Mode is active.
        
        A button to change modes is available every time a new song starts playing.`,
    },

    'sb': {
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

async function execute(interaction, resolvedUser, discordClient) { 

    const chosen = interaction.options.get('guide').value

    interaction.reply({ embeds: [ CreateEmbed(ctas[chosen].title, ctas[chosen].description, 'User Guide', interaction.member) ], ephemeral: true }).catch((err) => { log('Interaction Error', err) })

}

async function execute_voice(args, queue, user) { 

    user.send({ embeds: [CreateEmbed(ctas['voiceint'].title, ctas['voiceint'].description, 'Voice Interactions')] }).catch((err) => { log('Member Send Error', err) })

} 

export { command, commandData, execute, execute_voice }
