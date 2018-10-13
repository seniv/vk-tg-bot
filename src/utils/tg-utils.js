const fs = require('fs');
const config = require('../../config.json');
const { interlocutor } = require('../state');

const { VK_VERSION } = config;

const TgUtils = (app, vk) => {
  const errorHandler = (error, reply) => {
    console.error(error);
    if (reply) reply('Something went wrong...');
  };

  const onlySettedUser = (ctx, next) => {
    if (ctx.from.id === config.tg_user) {
      return next();
    }
  };

  const withSelecterReceiver = (ctx, next) => {
    if (!interlocutor.vkId) return ctx.reply(config.LOCALE.userNotSetted);
    return next();
  };

  const uploadToVK = async (file, text, stream = false) => {
    try {
      const uploadedPhoto = await vk.upload.messagePhoto({
        source: stream ? fs.createReadStream(file) : file,
      });

      await vk.api.messages.send({
        user_id: interlocutor.vkId,
        attachment: uploadedPhoto.toString(),
        message: text || '',
        v: VK_VERSION,
      });
    } catch (error) {
      errorHandler(error);
    }
  };
  return {
    errorHandler,
    onlySettedUser,
    withSelecterReceiver,
    uploadToVK,
  };
};

module.exports = {
  TgUtils,
};
