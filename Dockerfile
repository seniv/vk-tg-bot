FROM node:10-alpine as base

RUN mkdir /bot

WORKDIR /bot

ADD package.json /bot/package.json
ADD package-lock.json /bot/package-lock.json
ADD config.json /bot/config.json

RUN apk add vips-dev fftw-dev --no-cache --repository https://dl-3.alpinelinux.org/alpine/edge/testing/ &&\
    apk add --no-cache --virtual .build binutils make g++ python &&\
    apk add --no-cache jq &&\
    npm install && apk del .build

FROM base

ADD src /bot/src
ADD start.sh /bot/start.sh

CMD ["sh", "start.sh"]
