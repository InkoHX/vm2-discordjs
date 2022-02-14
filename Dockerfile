FROM node:16 AS build

WORKDIR /dist

COPY ./package-lock.json .
COPY ./package.json .
COPY ./src ./src

RUN npm ci --production

######################

FROM gcr.io/distroless/nodejs:16

WORKDIR /app

COPY --from=build /dist .

CMD [ "./src/index.js" ]
