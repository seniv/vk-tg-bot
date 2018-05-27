#!/usr/bin/env sh

echo "
{
  \"vk_token\": \"$VK_TOKEN\",
  \"tg_token\": \"$TG_TOKEN\",
  \"tg_user\": $TG_USER,
  \"keyboard\": [
    [\"/online\", \"/friends\"],
    [\"/friendson\", \"/history\"]
  ],
  \"timezone\": \"Europe/Kiev\"
}" > /bot/config.json

node /bot/tkbot.js