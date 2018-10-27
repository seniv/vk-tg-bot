const { VK } = require('vk-io');
const Telegraf = require('telegraf');

const config = require('../config');
const telegramSide = require('./telegram');
const vkSide = require('./vk');
const { TgUtils, VkUtils } = require('./utils');

const app = new Telegraf(config.tg_token);
const vk = new VK({ token: config.vk_token });

const tgUtils = TgUtils(app, vk);
const vkUtils = VkUtils(app, vk);

telegramSide(app, vk, tgUtils, vkUtils);
vkSide(app, vk, tgUtils, vkUtils);
