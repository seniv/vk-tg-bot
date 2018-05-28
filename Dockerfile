FROM mhart/alpine-node:10

RUN mkdir /bot
WORKDIR /bot
ADD package.json /bot/package.json

RUN apk add vips-dev fftw-dev --no-cache --repository https://dl-3.alpinelinux.org/alpine/edge/testing/ &&\
    apk add --no-cache --virtual .build binutils make g++ python &&\
    npm install && apk del .build

ADD tkbot.js /bot/tkbot.js
ADD start.sh /bot/start.sh

CMD ["sh", "start.sh"]