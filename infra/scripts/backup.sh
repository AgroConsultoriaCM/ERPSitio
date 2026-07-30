#!/bin/bash
# Backup do banco do ERPSitio.
#
# Uso:
#   ./infra/scripts/backup.sh                 # backup normal
#   DIAS_RETENCAO=60 ./infra/scripts/backup.sh
#
# Agendar diariamente às 2h (crontab -e):
#   0 2 * * * cd /home/ubuntu/ERPSitio && ./infra/scripts/backup.sh >> /var/log/erpsitio-backup.log 2>&1
#
# São dados reais de colheita e custo: sem backup, uma falha de disco
# significa refazer lançamento de campo que não volta.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ"

DESTINO="${DESTINO_BACKUP:-$RAIZ/backups}"
DIAS_RETENCAO="${DIAS_RETENCAO:-30}"
COMPOSE="${COMPOSE_FILE:-infra/docker-compose.vps.yml}"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

: "${POSTGRES_USER:?defina POSTGRES_USER no .env}"
: "${POSTGRES_DB:?defina POSTGRES_DB no .env}"

mkdir -p "$DESTINO"
CARIMBO="$(date +%Y-%m-%d_%H%M)"
ARQUIVO="$DESTINO/erpsitio_${CARIMBO}.sql.gz"

echo "[$(date '+%F %T')] iniciando backup -> $ARQUIVO"

# --clean --if-exists deixa o dump pronto para restaurar por cima de um banco
# existente, sem precisar recriá-lo antes
docker compose -f "$COMPOSE" exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  | gzip -9 > "$ARQUIVO"

TAMANHO=$(du -h "$ARQUIVO" | cut -f1)

# Um dump que não abre não é backup. Confere se o gzip está íntegro e se o
# conteúdo tem as tabelas esperadas.
if ! gzip -t "$ARQUIVO"; then
  echo "ERRO: arquivo corrompido, removendo" >&2
  rm -f "$ARQUIVO"
  exit 1
fi

# pipefail desligado neste trecho de propósito: grep encerra a leitura ao
# encontrar a primeira ocorrência, o que faz o gunzip receber SIGPIPE e
# derrubaria o script mesmo com o backup íntegro.
set +o pipefail
TABELAS=$(gzip -dc "$ARQUIVO" | grep -c 'CREATE TABLE public\."Talhao"' || true)
set -o pipefail

if [ "${TABELAS:-0}" -eq 0 ]; then
  echo "ERRO: dump não contém as tabelas esperadas, removendo" >&2
  rm -f "$ARQUIVO"
  exit 1
fi

echo "[$(date '+%F %T')] backup concluído ($TAMANHO) e verificado"

# Rotação: remove os mais antigos que o período de retenção
REMOVIDOS=$(find "$DESTINO" -name 'erpsitio_*.sql.gz' -type f -mtime +"$DIAS_RETENCAO" -print -delete | wc -l)
[ "$REMOVIDOS" -gt 0 ] && echo "removidos $REMOVIDOS backups com mais de $DIAS_RETENCAO dias"

echo "backups guardados: $(find "$DESTINO" -name 'erpsitio_*.sql.gz' | wc -l)"
