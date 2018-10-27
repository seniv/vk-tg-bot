const configJSON = require('./config.json');

// Get vk token, tg token and tg user from environment variables if exists
// otherwise get them from ./config.json file
module.exports = {
  ...configJSON,
  vk_token: process.env.VK_TOKEN || configJSON.vk_token,
  tg_token: process.env.TG_TOKEN || configJSON.tg_token,
  tg_user: parseInt(process.env.TG_USER, 10) || configJSON.tg_user,
};
