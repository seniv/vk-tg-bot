FROM node:10-slim as base

RUN mkdir /bot

WORKDIR /bot

ADD package.json /bot/package.json
ADD package-lock.json /bot/package-lock.json
ADD config.json /bot/config.json

RUN apt-get update &&\
    apt-get install -y jq &&\
    npm install --production &&\
    rm -rf /var/lib/apt/lists/*

FROM base

ADD src /bot/src
ADD start.sh /bot/start.sh

CMD ["sh", "start.sh"]
