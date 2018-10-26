#!/usr/bin/env sh

jq ".vk_token = \"$VK_TOKEN\" | .tg_token = \"$TG_TOKEN\" | .tg_user = $TG_USER" config.json > config.json.temp

rm config.json
mv config.json.temp config.json

npm start
