FROM ubuntu

# Install application dependencies
RUN apt update
RUN apt install -y curl
RUN curl --silent --show-error --fail --location \
      --header "Accept: application/tar+gzip, application/x-gzip, application/octet-stream" -o - \
      "https://caddyserver.com/download/linux/amd64?license=personal" \
    | tar --no-same-owner -C /usr/bin/ -xz caddy \
    && chmod 0755 /usr/bin/caddy \
    && /usr/bin/caddy -version
COPY . ./web-view
COPY ./Caddyfile /etc/Caddyfile
CMD [ "/usr/bin/caddy", "--conf", "/etc/Caddyfile", "--log", "stdout" ]