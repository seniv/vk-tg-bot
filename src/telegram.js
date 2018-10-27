const sharp = require('sharp');
const { Markup } = require('telegraf');
const request = require('request');
const moment = require('moment');
require('moment-timezone');
require('moment/locale/en-gb');
const config = require('../config');
const { interlocutor } = require('./state');

const { MAX_FRIENDS, VK_VERSION, LOCALE } = config;

module.exports = (app, vk, tgUtils, vkUtils) => {
  // these functions are in ./utils/tg-utils.js
  const {
    errorHandler,
    onlySettedUser,
    withSelecterReceiver,
    uploadToVK,
    uploadDocumentToVk,
  } = tgUtils;

  // these functions are in ./utils/vk-utils.js
  const { parseAttachments, parseForwards } = vkUtils;

  app.command('start', onlySettedUser, ({ reply }) =>
    reply(
      'Hello! keyboard created.',
      Markup
        .keyboard(config.keyboard)
        .oneTime()
        .resize()
        .extra(),
    ));

  app.command('myid', ({ from, reply }) => {
    console.log(from.id);
    return reply(from.id);
  });

  app.command('friends', onlySettedUser, async ({ reply }) => {
    try {
      const friends = await vk.api.friends.get({
        count: MAX_FRIENDS.all,
        order: 'hints',
        fields: 'last_seen,online',
        v: VK_VERSION,
      });

      const friendsList = friends.items.map((friend) => {
        const lastSeen = friend.last_seen
          ? moment.unix(friend.last_seen.time).tz(config.timezone).calendar()
          : '🤷‍♂️';
        const onlineStatus = friend.online ? '✅' : `🕑: ${lastSeen}`;
        return `${friend.first_name} ${friend.last_name} (/${friend.id}) ${onlineStatus}`;
      }).join('\n');

      reply(friendsList);
    } catch (error) {
      errorHandler(error, reply);
    }
  });

  app.command('friendson', onlySettedUser, async ({ reply }) => {
    try {
      const friends = await vk.api.friends.get({
        order: 'hints',
        fields: 'online',
        v: VK_VERSION,
      });

      const friendsOnline = friends.items.filter(friend => friend.online);
      const friendsList = friendsOnline.slice(0, MAX_FRIENDS.online).map(friend => (
        `${friend.first_name} ${friend.last_name} (/${friend.id})`
      )).join('\n');

      reply(`Online friends: ${friendsOnline.length}\n${friendsList}`);
    } catch (error) {
      errorHandler(error, reply);
    }
  });

  app.command('online', onlySettedUser, withSelecterReceiver, async ({ reply }) => {
    try {
      const [friend] = await vk.api.users.get({
        user_ids: interlocutor.vkId,
        fields: 'last_seen,online',
        v: VK_VERSION,
      });

      const lastSeen = friend.last_seen
        ? moment.unix(friend.last_seen.time).tz(config.timezone).calendar()
        : '🤷‍♂️';
      const onlineStatus = friend.online ? 'Online ✅' : `Offline, 🕑: ${lastSeen}`;

      reply(`ℹ️${friend.first_name} ${friend.last_name} is ${onlineStatus}`);
    } catch (error) {
      errorHandler(error, reply);
    }
  });

  app.command('history', onlySettedUser, withSelecterReceiver, async ({ reply }) => {
    try {
      const getUserRequest = vk.api.users.get({
        user_ids: interlocutor.vkId,
        fields: 'last_seen,online',
        v: VK_VERSION,
      });
      const getHistoryRequest = vk.api.messages.getHistory({
        user_id: interlocutor.vkId,
        v: VK_VERSION,
      });
      const [[user], history] = await Promise.all([getUserRequest, getHistoryRequest]);

      const userFullName = `${user.first_name} ${user.last_name}`;
      await reply(`History with ${userFullName}:\n`);

      history.items.reverse();

      const fullNameWithId = `${userFullName} (/${user.id})`;

      for (let i = 0; i < history.items.length; i++) {
        const message = history.items[i];

        await reply(`${message.out === 1 ? 'You' : fullNameWithId}:\n${message.body}`);

        if (message.attachments) {
          await parseAttachments(message.attachments);
        }

        if (message.fwd_messages) {
          await parseForwards(message.fwd_messages);
        }
      }
    } catch (error) {
      errorHandler(error, reply);
    }
  });

  app.on('text', onlySettedUser, async (ctx) => {
    const matchResult = ctx.update.message.text.match(/^\/[0-9]+/);
    if (matchResult) {
      const id = matchResult[0].slice(1);

      vk.api.users.get({
        user_ids: id,
        fields: 'last_seen,online',
        v: VK_VERSION,
      }).then(([user]) => {
        interlocutor.name = `👤${user.first_name} ${user.last_name}👤`;
        ctx.reply(`❗️User set to ${user.first_name} ${user.last_name} (/${user.id})❗️`, Markup
          .keyboard(config.keyboard.concat([[interlocutor.name]]))
          .oneTime()
          .resize()
          .extra());
        interlocutor.vkId = user.id;
      }).catch((error) => {
        console.error(error);
        ctx.reply('Error. Maybe this user does not exist!');
      });
      return true;
    }
    if (!interlocutor.vkId) return ctx.reply(LOCALE.userNotSetted);
    if (ctx.update.message.text === interlocutor.name) {
      return ctx.reply(LOCALE.clickOnUserInfoButton);
    }

    let msg = null;
    let attachment = null;

    if (ctx.message.reply_to_message) {
      const reply = ctx.message.reply_to_message;

      if (reply.photo) {
        const photo = reply.photo[reply.photo.length - 1];

        const link = await app.telegram.getFileLink(photo);

        attachment = await vk.upload.messagePhoto({ source: link });
      }

      if (reply.document) {
        attachment = await uploadDocumentToVk(reply.document);
      }

      msg = `${ctx.message.text}\n\n » ${reply.text ? reply.text : ''}`;
    } else {
      msg = ctx.message.text;
    }

    vk.api.messages.send({
      user_id: interlocutor.vkId,
      message: msg,
      v: VK_VERSION,
      attachment,
    }).catch((error) => {
      errorHandler(error, ctx.reply);
    });
  });

  app.on(['sticker', 'photo'], onlySettedUser, withSelecterReceiver, (ctx) => {
    const photo = ctx.updateSubTypes.includes('photo')
      ? ctx.update.message.photo[ctx.update.message.photo.length - 1]
      : ctx.update.message.sticker;

    return app.telegram.getFileLink(photo).then((file) => {
      if (ctx.updateSubTypes.includes('photo')) {
        return uploadToVK(file, ctx.update.message.caption);
      }

      const converter = sharp()
        .png()
        .toFormat('png');

      const converterStream = request(file)
        .on('error', e => errorHandler(e, ctx.reply))
        .pipe(converter);

      return uploadToVK(converterStream, ctx.update.message.caption);
    });
  });

  app.on('document', onlySettedUser, withSelecterReceiver, async (ctx) => {
    try {
      const uploadedDocument = await uploadDocumentToVk(ctx.message.document);

      await vk.api.messages.send({
        user_id: interlocutor.vkId,
        attachment: uploadedDocument.toString(),
        v: VK_VERSION,
      });
    } catch (error) {
      errorHandler(error, ctx.reply);
    }
  });

  app.on('voice', onlySettedUser, withSelecterReceiver, async (ctx) => {
    try {
      const link = await app.telegram.getFileLink(ctx.message.voice);
      const uploadedFile = await vk.upload.voice({
        source: link,
        peer_id: interlocutor.vkId,
      });
      await vk.api.messages.send({
        user_id: interlocutor.vkId,
        attachment: uploadedFile.toString(),
        v: VK_VERSION,
      });
    } catch (error) {
      errorHandler(error, ctx.reply);
    }
  });

  app.catch(err => console.error(err));

  app.startPolling();
};
