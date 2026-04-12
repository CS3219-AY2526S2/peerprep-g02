FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/QUDB.sql ./QUDB.sql
COPY --from=builder /app/question-upload-key.json ./question-upload-key.json
CMD ["npm", "run", "start"]