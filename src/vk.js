const config = require('../config.json');

const { VK_VERSION } = config;

module.exports = ({ telegram }, vk, tgUtils, vkUtils) => {
  const { parseAttachments, parseForwards } = vkUtils;

  vk.updates.startPolling().then(() => {
    console.log('Long Poll is started');
  }).catch((error) => {
    console.error(error);
  });

  vk.updates.on('message', async (ctx) => {
    if (!ctx.isInbox() || !ctx.isDM()) {
      return false;
    }
    try {
      await ctx.loadMessagePayload();

      const [user] = await vk.api.users.get({
        user_ids: ctx.getFrom().id,
        v: VK_VERSION,
      });

      await telegram.sendMessage(
        config.tg_user,
        `${user.first_name} ${user.last_name} (/${user.id}):\n${ctx.getText() || ''}`,
      );

      if (ctx.hasAttachments()) {
        const response = await vk.api.messages.getById({
          message_ids: ctx.getId(),
          v: VK_VERSION,
        });
        const [message] = response.items;
        await parseAttachments(message.attachments);
      }

      if (ctx.hasForwards()) {
        await parseForwards(ctx.getForwards());
      }
    } catch (error) {
      console.error(error);
    }
  });
};
