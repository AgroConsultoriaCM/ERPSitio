#!/bin/sh
set -e

# Valores padrao servem ao docker-compose local; em plataformas gerenciadas
# PORT e API_UPSTREAM chegam pelo ambiente.
export PORTA_WEB="${PORT:-80}"
export API_UPSTREAM="${API_UPSTREAM:-api:3333}"

echo "[web] nginx na porta ${PORTA_WEB}, encaminhando /api para ${API_UPSTREAM}"

envsubst '${PORTA_WEB} ${API_UPSTREAM}' \
  < /etc/nginx/templates/web.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
