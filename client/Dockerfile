# Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY client/package.json client/package-lock.json* ./
RUN npm ci || npm install

# Build application
COPY client/ ./
RUN npm run build

# Production Serving Stage
FROM nginx:alpine

# Copy custom Nginx configuration
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
