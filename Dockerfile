FROM mhart/alpine-node:10

RUN mkdir /bot

ADD package.json /bot/package.json
ADD tkbot.js /bot/tkbot.js
ADD start.sh /bot/start.sh

WORKDIR /bot

RUN npm install

CMD ["sh", "start.sh"]