FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/utils ./utils
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/constants.ts ./constants.ts
COPY --from=build /app/server.ts ./server.ts
EXPOSE 3001
CMD ["npm", "run", "start:container"]
