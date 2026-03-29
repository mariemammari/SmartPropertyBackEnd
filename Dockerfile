# -----------------------
# Étape 1 : Build + Tests
# -----------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

COPY node_modules ./node_modules

COPY . .

RUN npm run test

RUN npm run build

# -----------------------
# Étape 2 : Image production
# -----------------------
FROM node:20-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

CMD ["node", "dist/main.js"]