const {
  PhotoAttachment,
  VideoAttachment,
  WallAttachment,
  DocumentAttachment,
} = require('vk-io');
const { Extra } = require('telegraf');
const config = require('../../config');
const sharp = require('sharp');
const request = require('request');

const { VK_VERSION } = config;

const VkUtils = ({ telegram }, vk) => {
  const parseAttachments = async (attachments, wall = false) => {
    try {
      for (let i = 0; i < attachments.length; i++) {
        const atta = attachments[i];
        switch (atta.type) {
          case 'photo': {
            const photo = new PhotoAttachment(atta.photo, vk);
            await telegram.sendPhoto(config.tg_user, photo.getLargePhoto(), {
              caption: photo.getText(),
              disable_notification: true,
            });
            break;
          }
          case 'market': {
            const { market } = atta;

            const message = `Market title: ${market.title}\n\n` +
              `${market.description}\n\n` +
              `Price: ${market.price.text}\n`;

            await telegram.sendPhoto(config.tg_user, market.thumb_photo, {
              caption: message,
              disable_notification: true,
            });
            break;
          }
          case 'video': {
            const videoA = new VideoAttachment(atta.video, vk);
            const video = await vk.api.video.get({
              videos: videoA.toString(),
              v: VK_VERSION,
            });

            const text = wall
              ? `Video from wall: ${video.items[0].player}`
              : `Video: ${video.items[0].player}`;

            await telegram.sendMessage(config.tg_user, text, Extra.notifications(false));
            break;
          }
          case 'wall': {
            const wallAtta = new WallAttachment(atta.wall, vk);
            await telegram.sendMessage(
              config.tg_user, `Post on wall:\n${wallAtta.getText() || ''}`,
              Extra.notifications(false),
            );

            if (wallAtta.hasAttachments()) {
              await parseAttachments(atta.wall.attachments, true);
            }
            break;
          }
          case 'link':
            await telegram.sendMessage(
              config.tg_user,
              `URL: ${atta.link.url}\nTITLE: ${atta.link.title}`,
              Extra.notifications(false),
            );
            break;
          case 'sticker': {
            const stickerUrl = atta.sticker.photo_256 || atta.sticker.images[2];
            if (!stickerUrl) {
              await telegram.sendMessage(
                config.tg_user,
                'Error. Something wrong with this sticker...',
                Extra.notifications(false),
              );
              break;
            }

            const converter = sharp()
              .webp()
              .toFormat('webp');

            const converterStream = request(stickerUrl)
              .on('error', e => console.error(e))
              .pipe(converter);

            await telegram.sendDocument(
              config.tg_user,
              {
                source: converterStream,
                filename: 'sticker.webp',
              },
              Extra.notifications(false),
            );
            break;
          }
          case 'doc': {
            const doc = new DocumentAttachment(atta.doc, vk);
            if (doc.isVoice()) {
              await telegram.sendVoice(
                config.tg_user,
                doc.getPreview().audio_msg.link_ogg,
                Extra.notifications(false),
              );
            } else {
              await telegram.sendDocument(
                config.tg_user,
                doc.getUrl(),
                Extra.notifications(false),
              )
                .catch((err) => {
                  console.error(err);
                  return telegram.sendMessage(
                    config.tg_user,
                    "Error. Can't upload document",
                    Extra.notifications(false),
                  );
                });
            }
            break;
          }
          default:
            await telegram.sendMessage(
              config.tg_user,
              `*${atta.type}*`,
              Extra.notifications(false),
            );
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const parseForwards = async (forwards, level = 1) => {
    try {
      for (let i = 0; i < forwards.length; i++) {
        const forward = forwards[i];

        const [user] = await vk.api.users.get({
          user_ids: forward.user_id,
          v: VK_VERSION,
        });

        const quote = '» '.repeat(level);
        await telegram.sendMessage(
          config.tg_user,
          `${quote}${user.first_name} ${user.last_name} (/${user.id}): ${forward.body || ''}`,
        );

        if (forward.attachments) {
          await parseAttachments(forward.attachments);
        }

        if (forward.fwd_messages) {
          await parseForwards(forward.fwd_messages, level + 1);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  return {
    parseAttachments,
    parseForwards,
  };
};

module.exports = {
  VkUtils,
};
