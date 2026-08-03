#!/bin/bash
# Prova que o backup abre — restaurando de verdade, num banco descartável.
#
# Um arquivo .sql.gz que ninguém nunca restaurou não é backup, é esperança.
# Este script pega o backup mais recente, sobe um Postgres temporário, restaura
# dentro dele, conta o que voltou e destrói o container no fim.
#
# O banco de produção NÃO é tocado em momento nenhum: o container temporário
# tem nome próprio, volume próprio e some ao terminar.
#
# Uso:
#   ./infra/scripts/verificar-backup.sh            # confere o backup local
#   ./infra/scripts/verificar-backup.sh --nuvem    # baixa do Drive e confere
#
# O modo --nuvem é o que vale: testa a corrente inteira (envio, criptografia,
# senha e restauração). É ele que responde "se eu perder tudo hoje, eu volto?".
#
# Agendar mensalmente (crontab -e):
#   0 3 1 * * cd /home/ubuntu/ERPSitio && ./infra/scripts/verificar-backup.sh --nuvem >> /var/log/erpsitio-backup.log 2>&1
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ"

DESTINO="${DESTINO_BACKUP:-$RAIZ/backups}"
DA_NUVEM=0
[ "${1:-}" = "--nuvem" ] && DA_NUVEM=1

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

: "${POSTGRES_USER:?defina POSTGRES_USER no .env}"
: "${POSTGRES_DB:?defina POSTGRES_DB no .env}"

CONTAINER="erpsitio-conferencia-$$"
TRABALHO="$(mktemp -d)"

# Aconteça o que acontecer (erro, Ctrl+C), o container temporário some.
limpar() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$TRABALHO"
}
trap limpar EXIT

echo "=================================================="
echo " Conferência de backup do ERPSitio"
echo "=================================================="

# --- 1. obter o arquivo -----------------------------------------------------

if [ "$DA_NUVEM" -eq 1 ]; then
  : "${RCLONE_DESTINO:?defina RCLONE_DESTINO no .env}"
  : "${SENHA_BACKUP:?defina SENHA_BACKUP no .env}"

  echo "[1/4] baixando o backup mais recente de $RCLONE_DESTINO ..."
  ULTIMO=$(rclone lsf "$RCLONE_DESTINO" --include 'erpsitio_*.sql.gz.gpg' | sort | tail -1)
  if [ -z "$ULTIMO" ]; then
    echo "ERRO: nenhum backup encontrado em $RCLONE_DESTINO" >&2
    exit 1
  fi
  rclone copy "$RCLONE_DESTINO/$ULTIMO" "$TRABALHO" --no-traverse
  echo "      baixado: $ULTIMO"

  echo "      descriptografando..."
  ARQUIVO="$TRABALHO/${ULTIMO%.gpg}"
  if ! printf '%s' "$SENHA_BACKUP" | gpg --batch --quiet \
      --passphrase-fd 0 --pinentry-mode loopback \
      --decrypt "$TRABALHO/$ULTIMO" > "$ARQUIVO" 2>/dev/null; then
    echo "ERRO: não consegui abrir o arquivo com a SENHA_BACKUP atual." >&2
    echo "      A senha mudou? Sem ela, este backup não serve para nada." >&2
    exit 1
  fi
else
  echo "[1/4] procurando o backup local mais recente..."
  ARQUIVO=$(find "$DESTINO" -name 'erpsitio_*.sql.gz' -type f | sort | tail -1)
  if [ -z "$ARQUIVO" ]; then
    echo "ERRO: nenhum backup em $DESTINO" >&2
    exit 1
  fi
  echo "      usando: $(basename "$ARQUIVO")"
fi

# --- 2. subir um Postgres descartável ---------------------------------------

echo "[2/4] subindo um Postgres temporário ($CONTAINER)..."
# Sem -p: ninguém de fora alcança. Sem volume: morre com o container.
docker run -d --name "$CONTAINER" \
  -e POSTGRES_USER="$POSTGRES_USER" \
  -e POSTGRES_PASSWORD=conferencia \
  -e POSTGRES_DB="$POSTGRES_DB" \
  postgres:16-alpine >/dev/null

for _ in $(seq 1 30); do
  if docker exec "$CONTAINER" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
if ! docker exec "$CONTAINER" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
  echo "ERRO: o Postgres temporário não subiu" >&2
  exit 1
fi

# --- 3. restaurar -----------------------------------------------------------

echo "[3/4] restaurando o backup dentro dele..."
SAIDA="$TRABALHO/restauracao.log"
if ! gzip -dc "$ARQUIVO" | docker exec -i "$CONTAINER" \
     psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 --quiet > "$SAIDA" 2>&1; then
  echo "ERRO: a restauração falhou. Últimas linhas:" >&2
  tail -20 "$SAIDA" >&2
  exit 1
fi

# --- 4. conferir o que voltou -----------------------------------------------

echo "[4/4] conferindo o conteúdo restaurado..."
echo ""

CONSULTA='
SELECT rpad(t, 22) || lpad(n::text, 6) FROM (
  SELECT 1 o, $$Propriedade$$      t, count(*) n FROM "Propriedade"
  UNION ALL SELECT 2, $$Talhoes$$,        count(*) FROM "Talhao"
  UNION ALL SELECT 3, $$Setores irrig.$$, count(*) FROM "SetorIrrigacao"
  UNION ALL SELECT 4, $$Culturas$$,       count(*) FROM "Cultura"
  UNION ALL SELECT 5, $$Usuarios$$,       count(*) FROM "Usuario"
  UNION ALL SELECT 6, $$Colheitas$$,      count(*) FROM "Colheita"
  UNION ALL SELECT 7, $$Operacoes$$,      count(*) FROM "Atividade"
  UNION ALL SELECT 8, $$Analises de solo$$, count(*) FROM "AnaliseSolo"
  UNION ALL SELECT 9, $$Insumos$$,        count(*) FROM "Insumo"
) x ORDER BY o;'

docker exec -i "$CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -t -A -c "$CONSULTA"

TALHOES=$(docker exec -i "$CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -t -A -c 'SELECT count(*) FROM "Talhao";' | tr -d '[:space:]')
AREA=$(docker exec -i "$CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -t -A -c 'SELECT COALESCE(round(sum("areaHa")::numeric,2),0) FROM "Talhao";' | tr -d '[:space:]')

echo ""
echo "área total dos talhões restaurados: $AREA ha"
echo ""

if [ "${TALHOES:-0}" -eq 0 ]; then
  echo "ERRO: o backup restaurou, mas não veio nenhum talhão." >&2
  echo "      Alguma coisa está errada com o que está sendo salvo." >&2
  exit 1
fi

echo "=================================================="
echo " Backup íntegro: restaurou e os dados estão lá."
echo "=================================================="
