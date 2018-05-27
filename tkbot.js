const { VK } = require('vk-io')
const Telegraf = require('telegraf')
const { Extra, Markup } = require('telegraf')
const request = require('request')
const moment = require('moment')
const tz = require('moment-timezone')
require('moment/locale/en-gb')
const fs = require('fs')
const config = require('./config.json')
const webp = require('webp-converter')

const VK_VERSION = '5.65'

/*Тут можете изменить сколько друзей показывать в списке друзей
  Только не перестарайтесь, ибо в телеграма есть ограничение по длинне сообщений*/
const MAX_FRIENDS = {
  all: 50,
  online: 60,
}

/*Тут фразы бота, можете изменить если не нравятся */
const LOCALE = {
  userNotSetted: '❗️First select VK recipient!❗️', // Получатель сообщений не выбран
  clickOnUserInfoButton: '❗️dont tap on this button😀❗️' // Клик по кнопке с информацией о выбраном пользователе
}

const vk = new VK({ token: config.vk_token })
const app = new Telegraf(config.tg_token)

let currentUser
let useName

app.command('start', ({
  from,
  reply
}) => {
  if (from.id != config.tg_user) return false

  return reply('Hello! keyboard created.', Markup
    .keyboard(config.keyboard)
    .oneTime()
    .resize()
    .extra()
  )
})

app.command('myid', ({
  from,
  reply
}) => {
  console.log(from.id)
  return reply(from.id)
})

app.command('friends', async ({
  from,
  reply
}) => {
  if (from.id != config.tg_user) return false

  try {
    const friends = await vk.api.friends.get({
      count: MAX_FRIENDS.all,
      order: 'hints',
      fields: 'last_seen,online',
      v: VK_VERSION
    })

    const friendsList = friends.items.map(friend => {
      const lastSeen = friend.last_seen
        ? moment.unix(friend.last_seen.time).tz(config.timezone).calendar()
        : '🤷‍♂️'
      const onlineStatus = friend.online ? '✅' : `🕑: ${lastSeen}`
      return `${friend.first_name} ${friend.last_name} (/${friend.id}) ${onlineStatus}`
    }).join('\n')

    reply(friendsList)
  } catch (error) {
    errorHandler(error, reply)
  }
})

app.command('friendson', async ({
  from,
  reply
}) => {
  if (from.id != config.tg_user) return false

  try {
    const friends = await vk.api.friends.get({
      order: 'hints',
      fields: 'online',
      v: VK_VERSION
    })

    const friendsOnline = friends.items.filter(friend => friend.online)
    const friendsList = friendsOnline.slice(0, MAX_FRIENDS.online).map(friend => (
      `${friend.first_name} ${friend.last_name} (/${friend.id})`
    )).join('\n')

    reply(`Online friends: ${friendsOnline.length}\n${friendsList}`)
  } catch (error) {
    errorHandler(error, reply)
  }
})

app.command('online', async ({
  from,
  reply
}, ctx) => {
  if (from.id != config.tg_user) return false
  if (!currentUser) return reply(LOCALE.userNotSetted)

  try {
    const [friend] = await vk.api.users.get({
      user_ids: currentUser,
      fields: 'last_seen,online',
      v: VK_VERSION
    })

    const lastSeen = friend.last_seen
      ? moment.unix(friend.last_seen.time).tz(config.timezone).calendar()
      : '🤷‍♂️'
    const onlineStatus = friend.online ? 'Online ✅' : `Offline, 🕑: ${lastSeen}`

    reply(`ℹ️${friend.first_name} ${friend.last_name} is ${onlineStatus}`)
  } catch (error) {
    errorHandler(error, reply)
  }
})

app.on('text', (ctx) => {
  if (ctx.from.id != config.tg_user) return false
  let matchResult = ctx.update.message.text.match(/^\/[0-9]+/)
  if (matchResult) {
    let id = matchResult[0].slice(1)

    vk.api.users.get({
      user_ids: id,
      fields: 'last_seen,online',
      v: VK_VERSION
    }).then(([user]) => {
      useName = '👤' + user.first_name + ' ' + user.last_name + '👤'
      ctx.reply('❗️User set to ' + user.first_name + ' ' + user.last_name + ' (/' + user.id + ')❗️', Markup
        .keyboard(config.keyboard.concat([[useName]]))
        .oneTime()
        .resize()
        .extra())
      currentUser = user.id
    }).catch((error) => {
      console.error(error)
      ctx.reply('Error. Maybe this user does not exist!')
    })
    return true
  }
  if (!currentUser) return ctx.reply(LOCALE.userNotSetted)
  if (ctx.update.message.text == useName) return ctx.reply(LOCALE.clickOnUserInfoButton)

  vk.api.messages.send({
    user_id: currentUser,
    message: ctx.update.message.text,
    v: VK_VERSION
  }).catch((error) => {
    errorHandler(error, ctx.reply)
  })
})

app.on(['sticker', 'photo'], (ctx) => {
  if (ctx.from.id != config.tg_user) return false
  if (!currentUser) return ctx.reply(LOCALE.userNotSetted)

  let photo = ctx.updateSubTypes.includes('photo')
    ? ctx.update.message.photo[ctx.update.message.photo.length - 1]
    : ctx.update.message.sticker

  return app.telegram.getFileLink(photo).then(file => {
    if (ctx.updateSubTypes.includes('photo'))
      return uploadToVK(file, ctx.update.message.caption)
    
    let stickerPath = photo.file_id
    if (!fs.existsSync('stickers/')) {
      fs.mkdirSync('stickers/')
    }
    request(file, () => {
      let output = 'stickers/' + stickerPath + '.jpg'
      webp.dwebp('stickers/' + stickerPath, output, "-o", function (status) {
        return uploadToVK(output, ctx.update.message.caption, true)
      })
    }).pipe(fs.createWriteStream('stickers/' + stickerPath))
  })
})

app.on('voice', ctx => {
  if (ctx.from.id != config.tg_user) return false
  if (!currentUser) return ctx.reply(LOCALE.userNotSetted)

  app.telegram.getFileLink(ctx.message.voice).then(link => {
    return vk.upload.voice({
      source: link,
      peer_id: currentUser
    }).then(r => {
      return vk.api.messages.send({
        user_id: currentUser,
        attachment: 'doc' + r.owner_id + '_' + r.id,
        v: VK_VERSION
      })
    })
  }).catch(err => console.error(err))
})

app.catch(err => console.error(err))

app.startPolling()

function uploadToVK(file, text, stream = false) {
  return vk.upload.message({
    source: stream ? fs.createReadStream(file) : file
  }).then((photos) => {

    return vk.api.messages.send({
      user_id: currentUser,
      attachment: 'photo' + photos.owner_id + '_' + photos.id,
      message: text,
      v: VK_VERSION
    })
  })
}

vk.updates.startPolling().then(() => {
  console.log('Long Poll is started')
}).catch((error) => {
  console.error(error)
})

vk.updates.on('message', (ctx) => {
  if(!ctx.isInbox() || !ctx.isDM()) {
    return false
  }

  vk.api.users.get({
    user_ids: ctx.getFrom().id,
    v: VK_VERSION
  }).then(([user]) => {

    if (ctx.hasAttachments()) {
      getMessage({
        first_name: user.first_name,
        last_name: user.last_name,
        id: user.id
      }, ctx.getId())
    } else {
      app.telegram.sendMessage(config.tg_user, `${user.first_name} ${user.last_name} (/${user.id}):\n${ctx.getText()}`)
    }
  }).catch((error) => {
    console.error(error)
  })
})

function getMessage(user, id) {
  vk.api.messages.getById({
    message_ids: id,
    v: VK_VERSION
  }).then((response) => {
    const [message] = response.items
    console.log(message)

    return app.telegram.sendMessage(config.tg_user, `${user.first_name} ${user.last_name} (/${user.id}):\n${message.body}`).then(() => {
      parseAttachments(message.attachments)
    })
  }).catch(error => console.error(error))
}

function parseAttachments(attachments, wall = false) {
  for (let i = 0; i < attachments.length; i++) {
    let atta = attachments[i]
    switch (atta.type) {
      case 'photo':
        let attaimg = atta.photo.photo_1280 || atta.photo.photo_807 || atta.photo.photo_604 || atta.photo.photo_130 || atta.photo.photo_75
        app.telegram.sendPhoto(config.tg_user, attaimg, { caption: atta.photo.text, disable_notification: true })
        break
      case 'video':
        vk.api.video.get({
          videos: atta.video.owner_id + '_' + atta.video.id + '_' + atta.video.access_key,
          v: VK_VERSION
        }).then((video) => {
          let text = wall ? 'Video from wall: ' + video.items[0].player : 'Video: ' + video.items[0].player
          app.telegram.sendMessage(config.tg_user, text, Extra.notifications(false))
        }).catch((error) => {
          console.error(error)
        })
        break
      case 'wall':
        if (atta.wall.text) {
          app.telegram.sendMessage(config.tg_user, 'Post on wall:\n' + atta.wall.text, Extra.notifications(false)).then(() => {
            if (atta.wall.attachments)
              parseAttachments(atta.wall.attachments, true)
          })
        }
        break
      case 'link':
        app.telegram.sendMessage(config.tg_user, 'URL: ' + atta.link.url + '\nTITLE: ' + atta.link.title, Extra.notifications(false))
        break
      case 'sticker':
        app.telegram.sendPhoto(config.tg_user, atta.sticker.photo_256, Extra.notifications(false))
        break
      case 'doc':
        if(atta.doc.type)
          app.telegram.sendVoice(config.tg_user, atta.doc.preview.audio_msg.link_ogg, Extra.notifications(false))
        break
      default:
        app.telegram.sendMessage(config.tg_user, '*' + atta.type + '*', Extra.notifications(false))
    }
  }
}

function errorHandler (error, reply) {
  console.error(error)
  reply('Something went wrong...')
}