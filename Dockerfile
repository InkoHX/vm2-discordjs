FROM node:16 AS build

WORKDIR /dist

COPY ./package-lock.json .
COPY ./package.json .
COPY ./src ./src

RUN npm i --production

######################

FROM gcr.io/distroless/nodejs:16

WORKDIR /app

COPY --from=build /dist .

RUN adduser -S vm2

USER vm2

ENTRYPOINT [ "npm", "start" ]
