FROM node:20-bullseye AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build

FROM node:20-bullseye AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/public ./public
COPY --from=builder /app/app.js ./app.js
COPY --from=builder /app/env.js ./env.js
COPY --from=builder /app/index.html ./index.html
COPY --from=builder /app/style.css ./style.css
COPY --from=builder /app/src ./src
COPY --from=builder /app/vite.config.js ./vite.config.js

EXPOSE 3000 4173

CMD ["npm", "run", "start-prod-server"]
