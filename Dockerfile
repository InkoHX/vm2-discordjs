FROM node:14-alpine

ENV WORKDIR_PATH "/inkohx/app/vm2-discordjs"

COPY . ${WORKDIR_PATH}

WORKDIR ${WORKDIR_PATH}

RUN npm i --production && \
  npm cache clean --force

ENTRYPOINT [ "npm", "start" ]
