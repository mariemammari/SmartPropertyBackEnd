# -----------------------
# Étape 1 : Build + Tests
# -----------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run test

RUN npm run build

# -----------------------
# Étape 2 : Image production
# -----------------------
FROM node:20-alpine

WORKDIR /app

# Sécurité : utilisateur non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

# Installer seulement les dépendances de production
RUN npm ci --omit=dev

# Donner les droits à l'utilisateur
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

CMD ["node", "dist/main.js"]