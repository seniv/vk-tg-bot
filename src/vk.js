const config = require('../config');

const { VK_VERSION } = config;

module.exports = ({ telegram }, vk, tgUtils, vkUtils) => {
  // these functions are in ./utils/vk-utils.js
  const { parseAttachments, parseForwards } = vkUtils;

  vk.updates.startPolling().then(() => {
    console.log('Long Poll is started');
  }).catch((error) => {
    console.error(error);
  });

  vk.updates.on('message', async (ctx) => {
    // Only direct messages is supporter for now.
    if (!ctx.isInbox() || !ctx.isDM()) {
      return false;
    }
    try {
      // load more info about the message
      await ctx.loadMessagePayload();

      // get info about user that send the message
      const [user] = await vk.api.users.get({
        user_ids: ctx.getFrom().id,
        v: VK_VERSION,
      });

      // send message to telegram with message text and sender name
      await telegram.sendMessage(
        config.tg_user,
        `${user.first_name} ${user.last_name} (/${user.id}):\n${ctx.getText() || ''}`,
      );

      // if the message has attachments - load full info about the message
      if (ctx.hasAttachments()) {
        const response = await vk.api.messages.getById({
          message_ids: ctx.getId(),
          v: VK_VERSION,
        });
        const [message] = response.items;
        // and parse the attachments
        await parseAttachments(message.attachments);
      }

      // parse forwarded messages if they are
      if (ctx.hasForwards()) {
        await parseForwards(ctx.getForwards());
      }
    } catch (error) {
      console.error(error);
    }
  });
};
