'use-strict'; /* Ducky 2nd Generation Source Code, Created by Elucid */
import { EmbedBuilder } from 'discord.js'

export function CreateEmbed(title, description, author, member = false, color = null, fields = null, footer = null, overrideFooter = false, options = { thumbnail: false, url: false, image: false }) {

    const RichEmbed = new EmbedBuilder()

    if (title) { RichEmbed.setTitle(title) }
    if (description) { RichEmbed.setDescription(description) }
    if (author) { RichEmbed.setAuthor({ name: author }) }

    if (!color && !member) { color = '6ae2e2' }
    if (member && !color) { color = member.displayHexColor || '6ae2e2' }
    if (color === '#000000') { color = '6ae2e2' }

    RichEmbed.setColor(color)
    if (fields) { RichEmbed.addFields(fields) }

    if (options?.image) { RichEmbed.setImage(options.image) }
    if (options?.thumbnail) { RichEmbed.setThumbnail(options.thumbnail) }
    if (options?.url) { RichEmbed.setURL(options.url)}
    
    if (!overrideFooter) RichEmbed.setFooter({ iconURL: process.meta.config.botSettings.styles.footer.icon, text: footer ? `${process.meta.config.botSettings.styles.footer.text}\n${footer}` : process.meta.config.botSettings.styles.footer.text })
    else { RichEmbed.setFooter({ text: footer || 'No footer provided, but default overridden.' }) }

    return RichEmbed

}

export function WarningEmbed(title, description) {

    const RichEmbed = new EmbedBuilder()

    if (title) { RichEmbed.setTitle(title) }
    if (description) { RichEmbed.setDescription(description) }

    RichEmbed.setAuthor({ name: 'Encountered A Warning' })
    RichEmbed.setColor('f7e922')
    
    let initFooter = process.meta.config.botSettings.styles.footer.text
    RichEmbed.setFooter({ iconURL: process.meta.config.botSettings.styles.footer.icon, text: initFooter })

    return RichEmbed

}

export function ErrorEmbed(title, description) {

    const RichEmbed = new EmbedBuilder()

    if (title) { RichEmbed.setTitle(title) }
    if (description) { RichEmbed.setDescription(description) }

    RichEmbed.setAuthor({ name: 'Encountered An Error' })
    RichEmbed.setColor('f42e38')
    
    let initFooter = process.meta.config.botSettings.styles.footer.text
    RichEmbed.setFooter({ iconURL: process.meta.config.botSettings.styles.footer.icon, text: initFooter })

    return RichEmbed

}