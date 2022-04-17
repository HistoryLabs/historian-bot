FROM node:16.10-alpine

RUN mkdir -p /historian_bot && chown -R node:node /historian_bot
WORKDIR /historian_bot
COPY --chown=node:node . .

USER node

RUN npm install --frozen-lockfile
RUN npm run build

CMD ["npm", "start"]