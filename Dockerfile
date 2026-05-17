# ============================================================
# Dockerfile - Frontend React (producción)
# ============================================================
# Multi-stage: build con Node, servir con Nginx

# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve con Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Config de Nginx para SPA (redirigir todo a index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
