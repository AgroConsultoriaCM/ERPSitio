# Build no contexto da raiz do monorepo:
#   docker build -f apps/api/Dockerfile -t erpsitio-api .
FROM node:20-alpine AS base
WORKDIR /repo

# CA extra opcional (ex: antivirus/proxy corporativo que inspeciona HTTPS na
# maquina que faz o build/roda o container). Pasta vazia numa VPS limpa =
# nenhum efeito nestes passos. Anexa direto no bundle do sistema (usado por
# apk/openssl) em vez de depender do pacote ca-certificates, que ainda nao
# esta instalado nesta imagem base. Precisa vir ANTES de qualquer apk/npm
# que acesse a rede. Veja infra/certs/README.md.
COPY infra/certs/ /tmp/extra-certs/
RUN (cat /tmp/extra-certs/*.crt >> /etc/ssl/certs/ca-certificates.crt 2>/dev/null || true) && \
    (cat /tmp/extra-certs/*.crt > /tmp/extra-ca.pem 2>/dev/null || true) && touch /tmp/extra-ca.pem
ENV NODE_EXTRA_CA_CERTS=/tmp/extra-ca.pem

# node:20-alpine nao vem com o pacote OpenSSL, e o binario do Prisma
# (schema-engine/query-engine) precisa dele para detectar a versao correta
# em tempo de execucao - sem isso ele falha ao carregar o engine.
RUN apk add --no-cache openssl

FROM base AS deps
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm install

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/db packages/db
COPY apps/api apps/api
RUN npm run generate --workspace packages/db
RUN npm run build --workspace packages/db
RUN npm run build --workspace apps/api

FROM base AS runtime
ENV NODE_ENV=production
# package.json da raiz precisa estar presente para "npm run seed --workspace
# packages/db" funcionar manualmente depois (ver README) - o servidor em si
# (CMD abaixo) roda direto com node e nao depende disso.
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/db ./packages/db
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json

EXPOSE 3333
CMD ["node", "apps/api/dist/server.js"]
