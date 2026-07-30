#!/bin/bash
# Restaura um backup do ERPSitio.
#
#   ./infra/scripts/restaurar.sh backups/erpsitio_2026-07-30_0200.sql.gz
#
# ATENÇÃO: substitui os dados atuais do banco pelos do arquivo. O script pede
# confirmação e tira um backup de segurança antes de mexer em qualquer coisa.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ"

ARQUIVO="${1:-}"
COMPOSE="${COMPOSE_FILE:-infra/docker-compose.vps.yml}"

if [ -z "$ARQUIVO" ] || [ ! -f "$ARQUIVO" ]; then
  echo "uso: $0 <arquivo.sql.gz>" >&2
  echo "" >&2
  echo "backups disponíveis:" >&2
  ls -lh backups/erpsitio_*.sql.gz 2>/dev/null || echo "  (nenhum)" >&2
  exit 1
fi

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

: "${POSTGRES_USER:?defina POSTGRES_USER no .env}"
: "${POSTGRES_DB:?defina POSTGRES_DB no .env}"

echo "Arquivo:  $ARQUIVO ($(du -h "$ARQUIVO" | cut -f1))"
echo "Banco:    $POSTGRES_DB"
echo ""
echo "Isto SUBSTITUI os dados atuais do banco."
read -r -p "Digite RESTAURAR para confirmar: " confirmacao
[ "$confirmacao" = "RESTAURAR" ] || { echo "cancelado"; exit 1; }

# Rede de segurança: se a restauração for a errada, ainda dá para voltar
echo "-> tirando backup de segurança do estado atual..."
DESTINO_BACKUP="$RAIZ/backups" ./infra/scripts/backup.sh

echo "-> restaurando..."
zcat "$ARQUIVO" | docker compose -f "$COMPOSE" exec -T db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 --quiet

echo "-> reiniciando a API para limpar cache em memória..."
docker compose -f "$COMPOSE" restart api

echo "restauração concluída"
