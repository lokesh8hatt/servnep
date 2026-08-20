# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps
COPY --from=builder /app/dist ./dist

# Run as a non-root user rather than the image's default root.
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 5000
CMD ["node", "dist/main"]
