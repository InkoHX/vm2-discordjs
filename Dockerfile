FROM node:15-alpine AS build

WORKDIR /dist

COPY ./package-lock.json .
COPY ./package.json .
COPY ./worker.js .
COPY ./index.js .

RUN npm i --production

######################

FROM node:15-alpine

WORKDIR /app

COPY --from=build /dist .

RUN adduser -S vm2

USER vm2

ENTRYPOINT [ "npm", "start" ]
