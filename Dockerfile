FROM node:15-alpine

WORKDIR /inkohx/app/vm2-discordjs

COPY ./package-lock.json .
COPY ./package.json .

# Source
COPY ./worker.js .
COPY ./index.js .

RUN npm i --production && \
  npm cache clean --force

ENTRYPOINT [ "npm", "start" ]
