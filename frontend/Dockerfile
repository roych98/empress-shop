FROM node:current-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY eslint.config.js ./

RUN npm ci

COPY . .

EXPOSE 5173

ENV HOST=0.0.0.0

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

