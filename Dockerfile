# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install bun for building (since the project uses bun.lock)
RUN npm install -g bun

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy built files from builder
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json

# Install production dependencies with npm
RUN npm install --production --omit=dev

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Start the application with Node.js
CMD ["node", ".output/server/index.mjs"]
