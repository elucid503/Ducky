'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { getExistingDBEntry, createDBEntry, updateDBEntry } from '../functions/data.js'

export function getServer(guildId, client) { 

    let guildData = client.guilds.cache.get(guildId)
    let existingServer = getExistingDBEntry(guildId, 'guilds')
    let resolvedServer = new server(existingServer, guildData)
    if (resolvedServer.error) { throw new Error(resolvedServer.error) }
    if (!existingServer) { resolvedServer.create() }
    return resolvedServer

}

export default class server {

    constructor(existingServer, guildData) {

        this.serverID = existingServer?.id || guildData.id
        this.serverName = existingServer?.name || guildData.name
        this.settings = existingServer?.settings || { enableClips: true, smartJoin: true, leaveOnEmpty: true, softVolume: true }
        this.meta = existingServer?.meta || { createdAt: (new Date().getTime() / 1000).toFixed() }

    }

    fetchGuild() { return process.meta.client.guilds.cache.get(this.serverID) }
    
    create() {

        createDBEntry(this, 'guilds')
        
    } 

    update(key, value) {

        this[key] = value 
        updateDBEntry(this.serverID, key, value, 'guilds')

    }

}