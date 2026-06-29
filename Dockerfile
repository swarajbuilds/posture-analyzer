FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Create nginx config that uses PORT env variable (Cloud Run requirement)
RUN echo 'server { \
    listen 8080; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Copy static files
COPY . /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
