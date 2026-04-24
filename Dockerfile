# ── Etapa 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar dependencias primero (mejor cache de Docker)
COPY package*.json ./
RUN npm ci

# Copiar código fuente y compilar
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Etapa 2: Producción ───────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Solo instalar dependencias de producción
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copiar el build compilado
COPY --from=builder /app/dist ./dist

# Usuario no-root por seguridad
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Exponer puertos
EXPOSE 8080
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/state || exit 1

CMD ["node", "dist/index.js"]
