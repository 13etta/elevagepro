FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/private-uploads /app/src/public/uploads /var/data/private /var/data/public && chown -R node:node /app/private-uploads /app/src/public/uploads /var/data

ENV NODE_ENV=production

EXPOSE 3000

USER node

CMD ["npm", "start"]
