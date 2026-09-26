# ----- Stage 1: Build -----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml* package-lock.json* ./
RUN npm install -g pnpm && pnpm install || npm install

COPY . .
RUN pnpm run build || npm run build

# ----- Stage 2: Serve with Nginx -----
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["sh", "-c", "sed -i 's/listen  *80;/listen 8080;/g' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
