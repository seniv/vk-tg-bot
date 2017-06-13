const VK = require('vk-io');
const Telegraf = require('telegraf')
const { Extra, Markup } = require('telegraf')
const request = require('request');
const moment = require('moment');
const tz = require('moment-timezone');
require('moment/locale/en-gb');
const fs = require('fs');

const VK_TOKEN = 'ВАШ ВК ТОКЕН';
const BOT = 'ВАШ ТОКЕН БОТА';
const USER = *ID пользователя телеграм*;
const VK_VERSION = '5.65';

const vk = new VK({ token: VK_TOKEN });
const app = new Telegraf(BOT)

let currentUser;

app.command('start', ({
  from,
  reply
}) => {
  if (from.id != USER) return false;

  return reply('Hello! keyboard created.', Markup
    .keyboard([
      ['/online', '/friends']
    ])
    .oneTime()
    .resize()
    .extra()
  )
})

app.command('friends', ({
  from,
  reply
}) => {
  if (from.id != USER) return false;

  vk.api.friends.get({
    count: 20,
    order: 'hints',
    fields: 'last_seen,online',
    v: VK_VERSION
  }).then((friends) => {
    let format = '';
    for (let i = 0; i < friends.items.length; i++) {
      let friend = friends.items[i];
      let on = moment.unix(friend.last_seen.time).tz("Europe/Kiev").calendar();
      let status = (friend.online) ? ' (Online)' : ' (last seen: ' + on + ')';
      format += friend.first_name + ' ' + friend.last_name + ' (/' + friend.id + ')' + status + '\n';
    }
    reply(format);
  }).catch((error) => {
    console.error(error)
  });
})

app.command('online', ({
  from,
  reply
}) => {
  if (from.id != USER) return false;
  if (!currentUser) return reply('❗️Set VK user!❗️');

  vk.api.users.get({
    user_ids: currentUser,
    fields: 'last_seen,online',
    v: VK_VERSION
  }).then((user) => {
    let on = moment.unix(user[0].last_seen.time).tz("Europe/Kiev").calendar();
    let status = (user[0].online) ? ' is Online' : ' is Offline. last seen: ' + on;
    reply(user[0].first_name + ' ' + user[0].last_name + status);
  }).catch((error) => {
    console.error(error)
  });
  return true;
})

app.on('text', (ctx) => {
  if (ctx.from.id != USER) return false;

  let matchResult = ctx.update.message.text.match(/^\/[0-9]+/);
  if (matchResult) {
    let id = matchResult[0].slice(1);

    vk.api.users.get({
      user_ids: id,
      fields: 'last_seen,online',
      v: VK_VERSION
    }).then((user) => {
      msg(false, '❗️User set to *' + user[0].first_name + ' ' + user[0].last_name + ' (/' + user[0].id + ')*❗️', true);
      currentUser = user[0].id;
    }).catch((error) => {
      console.error(error)
    });
    return true;
  }
  if (!currentUser) return msg(false, '❗️Set VK user!❗️');

  vk.api.messages.send({
    user_id: currentUser,
    message: ctx.update.message.text,
    v: VK_VERSION
  }).catch((error) => {
    console.error(error)
  });
})

app.on('photo', (ctx) => {
  if (ctx.from.id != USER) return false;
  if (!currentUser) return msg(false, '❗️Set VK user!❗️');

  let photo = ctx.update.message.photo[ctx.update.message.photo.length - 1];

  tgapi('/getFile?file_id=' + photo.file_id, (r) => {

    request('https://api.telegram.org/file/bot' + BOT + '/' + r.result.file_path, () => {

      vk.upload.message({
        source: fs.createReadStream(r.result.file_path)
      }).then((photos) => {

        vk.api.messages.send({
          user_id: currentUser,
          attachment: 'photo' + photos.owner_id + '_' + photos.id,
          message: ctx.update.message.caption,
          v: VK_VERSION
        }).catch((error) => {
          console.error(error)
        });

      }).catch((error) => {
        console.error(error)
      })
    }).pipe(fs.createWriteStream(r.result.file_path))
  })
})

app.startPolling()

vk.longpoll.start().then(() => {
  console.log('Long Poll is started');
}).catch((error) => {
  console.error(error);
});

vk.longpoll.on('message', (message) => {
  for (let i = 0; i < message.flags.length; i++) {
    if (message.flags[i] == 'outbox') return false;
  }
  if (message.from != 'dm') return false;

  vk.api.users.get({
    user_ids: message.user,
    v: VK_VERSION
  }).then((user) => {

    if (Object.keys(message.attachments).length) {
      getMessage({
        first_name: user[0].first_name,
        last_name: user[0].last_name,
        id: user[0].id
      }, message.id);
    } else {
      msg({
        first_name: user[0].first_name,
        last_name: user[0].last_name,
        id: user[0].id
      }, message.text);
    }
  }).catch((error) => {
    console.error(error)
  });
});

function getMessage(user, id) {
  vk.api.messages.getById({
    message_ids: id,
    v: VK_VERSION
  }).then((message) => {
    message = message.items[0];

    msg(user, message.body);
    setTimeout(() => {
      parseAttachments(message.attachments, false);
    }, 100);
  }).catch((error) => {
    console.error(error)
  });
}

function parseAttachments(attachments, wall) {
  for (let i = 0; i < attachments.length; i++) {
    let atta = attachments[i];
    switch (atta.type) {
      case 'photo':
        let attaimg = atta.photo.photo_1280 || atta.photo.photo_807 || atta.photo.photo_604 || atta.photo.photo_130 || atta.photo.photo_75;
        tgapi('/sendPhoto?chat_id=' + USER + '&photo=' + attaimg + '&caption=' + encodeURI(atta.photo.text), (r) => {});
        break;
      case 'video':
        vk.api.video.get({
          videos: atta.video.owner_id + '_' + atta.video.id + '_' + atta.video.access_key,
          v: VK_VERSION
        }).then((video) => {
          let text = wall ? 'Video from wall: ' + video.items[0].player : 'Video: ' + video.items[0].player;
          msg(false, text);
        }).catch((error) => {
          console.error(error)
        });
        break;
      case 'wall':
        if (atta.wall.text) {
          msg(false, 'Post on wall:\n' + atta.wall.text);
        }
        if (atta.wall.attachments) {
          setTimeout(() => {
            parseAttachments(atta.wall.attachments, true);
          }, 100);
        }
        break;
      default:
        msg(false, '*' + atta.type + '*');
    }
  }
}

function msg(user, text, md = false) {
  let markdown = md ? '&parse_mode=markdown' : '';
  text = user ? user.first_name + ' ' + user.last_name + ' (/' + user.id + '):\n' + text : text;
  request('https://api.telegram.org/bot' + BOT + '/sendMessage?chat_id=' + USER + markdown + '&text=' + encodeURI(text))
}

function tgapi(req, callback) {
  request('https://api.telegram.org/bot' + BOT + req, (err, res, r) => {
    if (err) console.error(err);
    else if (res.statusCode != 200) console.error('statusCode: ' + res.statusCode);
    else {
      r = JSON.parse(r);
      callback(r);
    }
  })
}
