FROM  node:18 AS builder

WORKDIR /app
COPY package.json .
RUN npm install
# Copy other files to my current directory
COPY . .

# Build and optimize static file
RUN npm run build

# Stage-2
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the static file to my Nginx folder to serve static contain
COPY --from=builder /app/build /usr/share/nginx/html

# Open the port to react
EXPOSE 80

# Run nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
