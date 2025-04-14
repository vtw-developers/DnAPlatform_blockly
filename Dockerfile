# Build stage
FROM node:18-alpine as build

# Build arguments
ARG VITE_LOCAL_API_URL
ARG VITE_INTERNAL_API_URL
ARG VITE_PUBLIC_API_URL
ARG VITE_API_URL

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 5050

CMD ["nginx", "-g", "daemon off;"] 