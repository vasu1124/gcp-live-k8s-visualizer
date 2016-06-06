FROM akkerman/rpi-nginx

COPY src/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/
