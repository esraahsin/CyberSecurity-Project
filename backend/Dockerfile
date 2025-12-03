FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

FROM node:18-alpine

# Install dumb-init
RUN apk add --no-cache dumb-init

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

# Create logs directory BEFORE switching to non-root user
RUN mkdir -p logs && chmod 777 logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# Use npm start instead of hardcoding the entry point
CMD ["npm", "start"]