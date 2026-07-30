# Build no contexto da raiz do monorepo:
#   docker build -f apps/web/Dockerfile -t erpsitio-web --build-arg VITE_API_URL=/api/v1 .
FROM node:20-alpine AS deps
WORKDIR /repo
# CA extra opcional (ex: antivirus/proxy corporativo que inspeciona HTTPS na
# maquina que faz o build). Pasta vazia numa VPS limpa = nenhum efeito.
# Veja infra/certs/README.md.
COPY infra/certs/ /tmp/extra-certs/
RUN (cat /tmp/extra-certs/*.crt >> /etc/ssl/certs/ca-certificates.crt 2>/dev/null || true) && \
    (cat /tmp/extra-certs/*.crt > /tmp/extra-ca.pem 2>/dev/null || true) && touch /tmp/extra-ca.pem
ENV NODE_EXTRA_CA_CERTS=/tmp/extra-ca.pem
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm install

FROM deps AS build
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
COPY apps/web apps/web
RUN npm run build --workspace apps/web

FROM nginx:1.27-alpine AS runtime
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY infra/nginx/web.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
