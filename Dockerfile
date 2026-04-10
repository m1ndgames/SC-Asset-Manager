# Stage 1 — fetch SC item/location data from scunpacked-data
FROM python:3.12-slim AS data-fetcher
WORKDIR /app
COPY scripts/fetch_items.py ./scripts/fetch_items.py
RUN python scripts/fetch_items.py

# Stage 2 — build the SvelteKit static app
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
COPY --from=data-fetcher /app/static/items.json     ./static/items.json
COPY --from=data-fetcher /app/static/locations.json ./static/locations.json
RUN npm run build

# Stage 3 — serve with nginx
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
