'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import fs from 'fs'
import path from 'path'
import { log } from './misc.js'
import { customAlphabet } from 'nanoid'

export function createTempFile(data = { }) {

    const makeId = customAlphabet('1234567890', 18)
    let id = makeId()

    while (fs.existsSync(path.join('./data', `/temp/${id}.json`))) { id = makeId() }

    data['_id'] = id

    try { fs.writeFileSync(path.join('./data', `/temp/${id}.json`), JSON.stringify(data, null, 2)) } catch (err) { log('File Out Error', err); throw new Error("A file refused to be written.\nPlease check that Ducky or it's database is not undergoing maintence.") }

    return path.join('./data', `/temp/${id}.json`)

}

export function updateTempFile(id = null, key = '_id', value = id) {

    let data;
    const queryPath = path.join('./data', `/temp/${id}.json`) 

    if (!(fs.existsSync(queryPath))) { throw new Error("A data file could not be found.\nPlease check that Ducky or it's database is not undergoing maintence.") }

    try { data = JSON.parse(fs.readFileSync(queryPath)) } catch (err) { log('File In Error', err); throw new Error("A file refused to be read.\nPlease check that Ducky or it's database is not undergoing maintence.") }
    
    data[key] = value

    try { fs.writeFile(path.join('./data', `/temp/${id}.json`), JSON.stringify(data, null, 2)) } catch (err) { log('File Out Error', err); throw new Error("A file refused to be written.\nPlease check that Ducky or it's database is not undergoing maintence.")}

    return path.join('./data', `/temp/${id}.json`)

}

export function removeTempFile(id = null) {

    const queryPath = path.join('./data', `/temp/${id}.json`) 

    if (!(fs.existsSync(queryPath))) { throw new Error("A data file could not be found.\nPlease check that Ducky or it's database is not undergoing maintence.") }

    try { fs.unlinkSync(queryPath) } catch (err) { log('File Unlink Error', err); throw new Error("A data file could not be deleted.\nPlease check that Ducky or it's database is not undergoing maintence.")}
    
    return 0

}

export function getExistingDBEntry(id = null, type = 'users') { 

    const queryPath = path.join('./data', `/${type}/${id}.json`) 

    if (!(fs.existsSync(queryPath))) { return }

    let data;
    try { data = JSON.parse(fs.readFileSync(queryPath)) } catch (err) {
        log('File In Error', err);
        return 
    }

    return data 

}

export function createDBEntry(data = { "404": true }, type = 'users') { 

    const queryPath = path.join('./data', `/${type}/${data.discordID || data.ids?.duckyID || data.serverID || data.parent}.json`) 

    if ((fs.existsSync(queryPath))) { return }

    try { fs.writeFileSync(queryPath, JSON.stringify(data, null, 2)) } catch (err) { log('File Out Error', err); throw new Error("A file refused to be read.\nPlease check that Ducky or it's database is not undergoing maintence.") }

    return queryPath 

}

export function updateDBEntry(id = false, key = "_id", value = id, type = 'users') { 

    let data;
    try {
        let fileData = readFileSync(`./data/${type}/${id}.json`)
        data = JSON.parse(fileData)
    } catch (err) {  }
    data[key] = value 

    try { fs.writeFileSync(`./data/${type}/${id}.json`, JSON.stringify(data, null, 2)) } catch (err) { log('File Out Error', err); throw new Error("A file refused to be read.\nPlease check that Ducky or it's database is not undergoing maintence.") }

    return `./data/${type}/${id}.json` 

}

export function overwriteDBEntry(data, type = 'users') { 

    const queryPath = path.join('./data', `/${type}/${data.discordID || data.ids?.duckyID || data.serverID || data.parent}.json`) 

    try { fs.writeFileSync(queryPath, JSON.stringify(data, null, 2)) } catch (err) { log('File Out Error', err); throw new Error("A file refused to be read.\nPlease check that Ducky or it's database is not undergoing maintence.") }

    return queryPath 

}

export function clearTemp() { 

    const queryPath = path.join('./data', `/temp`) 

    let files 
    try { files = fs.readdirSync(queryPath) } catch (err) { log('Dir In Error', err); throw new Error("A directory refused to be read.\nPlease check that Ducky or it's database is not undergoing maintence.") }
 
    files.forEach((file) => { 

        try { fs.unlinkSync(path.join(queryPath, file)) } catch (err) { log('File Unlink Error', err); }

    })

    return true 

}

export function removeDBentry(id = null) {

    const queryPath = path.join('./data', `/temp/${id}.json`) 

    if (!(fs.existsSync(queryPath))) { throw new Error("A data file could not be found.\nPlease check that Ducky or it's database is not undergoing maintence.") }

    try { fs.unlinkSync(queryPath) } catch (err) { log('File Unlink Error', err); throw new Error("A data file could not be deleted.\nPlease check that Ducky or it's database is not undergoing maintence.")}
    
    return 0

}


export function findCachedSong(input) { 

    const queryPath = path.join('./data', `/songs`) 

    let files; let target
    try { files = fs.readdirSync(queryPath) } catch (err) { log('Dir In Error', err); throw new Error("A directory refused to be read.\nPlease check that Ducky or it's database is not undergoing maintence.") }
 
    for (const file of files) { 

        let data;
        try { data = JSON.parse(fs.readFileSync(path.join(queryPath, file))) } catch (err) { log('File In Error', err); throw new Error("A file refused to be read.\nPlease check that Ducky or it's database is not undergoing maintence.") }
    
        if (data.meta.search === input.toLowerCase() || data.titles.display.lower === input.toLowerCase()) { target = data; break }

    }

    return target

}

