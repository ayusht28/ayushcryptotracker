FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

EXPOSE 3002

CMD ["node", "src/index.js"]
