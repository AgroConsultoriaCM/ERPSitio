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
#
# Guarda em duas camadas:
#   1. no disco da máquina  -> resolve "restaura o de ontem"
#   2. no Google Drive      -> resolve perder a máquina ou a conta da Oracle
#
# A camada 2 depende de duas variáveis no .env (ver infra/oracle/README-micro.md):
#   RCLONE_DESTINO=drive:ERPSitio/backups
#   SENHA_BACKUP=<senha longa>   # sem ela o arquivo não abre. Guarde fora daqui.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ"

DESTINO="${DESTINO_BACKUP:-$RAIZ/backups}"
DIAS_RETENCAO="${DIAS_RETENCAO:-30}"
COMPOSE="${COMPOSE_FILE:-infra/docker-compose.vps.yml}"
# Fora da máquina o espaço é barato e é a última linha de defesa: guarda mais.
DIAS_RETENCAO_NUVEM="${DIAS_RETENCAO_NUVEM:-180}"

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

# --- cópia fora da máquina --------------------------------------------------
#
# Roda num subshell com tratamento próprio: se o Drive estiver fora do ar, o
# backup local continua válido e o script não pode morrer antes da rotação.
# Mas a falha precisa aparecer — backup remoto que parou há três meses em
# silêncio é o jeito clássico de descobrir tarde demais.
FALHA_ENVIO=0

enviar_para_fora() {
  local origem="$1"
  local cifrado="${origem}.gpg"

  if ! command -v rclone >/dev/null 2>&1; then
    echo "ERRO: RCLONE_DESTINO definido mas o rclone não está instalado" >&2
    return 1
  fi
  if [ -z "${SENHA_BACKUP:-}" ]; then
    echo "ERRO: defina SENHA_BACKUP no .env. Não vou mandar dado de colheita," >&2
    echo "      custo e senha de usuário para a nuvem sem criptografia." >&2
    return 1
  fi

  echo "[$(date '+%F %T')] criptografando..."
  # A senha vai pela entrada padrão, não como argumento: argumento aparece
  # para qualquer um que rode "ps" na máquina.
  if ! printf '%s' "$SENHA_BACKUP" | gpg --batch --yes --quiet \
      --passphrase-fd 0 --pinentry-mode loopback \
      --symmetric --cipher-algo AES256 \
      --output "$cifrado" "$origem"; then
    echo "ERRO: falha ao criptografar" >&2
    rm -f "$cifrado"
    return 1
  fi

  # Prova que a senha configurada realmente abre o arquivo, agora, enquanto dá
  # tempo de corrigir. Descobrir no dia do desastre que a senha estava errada
  # é o mesmo que não ter backup.
  if ! printf '%s' "$SENHA_BACKUP" | gpg --batch --quiet \
      --passphrase-fd 0 --pinentry-mode loopback \
      --decrypt "$cifrado" 2>/dev/null | gzip -t; then
    echo "ERRO: o arquivo criptografado não reabre com esta senha" >&2
    rm -f "$cifrado"
    return 1
  fi

  echo "[$(date '+%F %T')] enviando para $RCLONE_DESTINO ..."
  if ! rclone copy "$cifrado" "$RCLONE_DESTINO" --no-traverse; then
    echo "ERRO: o envio falhou" >&2
    rm -f "$cifrado"
    return 1
  fi

  # Conferir que chegou: "rclone copy" sem erro não é o mesmo que arquivo lá.
  if ! rclone lsf "$RCLONE_DESTINO/$(basename "$cifrado")" >/dev/null 2>&1; then
    echo "ERRO: o arquivo não aparece no destino depois do envio" >&2
    rm -f "$cifrado"
    return 1
  fi

  rm -f "$cifrado"
  echo "[$(date '+%F %T')] cópia externa confirmada"

  # Rotação remota. Sem --min-age isto apagaria o que acabou de subir.
  rclone delete "$RCLONE_DESTINO" \
    --min-age "${DIAS_RETENCAO_NUVEM}d" --include 'erpsitio_*.sql.gz.gpg' || true
}

if [ -n "${RCLONE_DESTINO:-}" ]; then
  enviar_para_fora "$ARQUIVO" || FALHA_ENVIO=1
else
  echo "AVISO: RCLONE_DESTINO não definido — o backup existe só nesta máquina."
  echo "       Se a instância for perdida, o banco vai junto."
fi

# Rotação: remove os mais antigos que o período de retenção
REMOVIDOS=$(find "$DESTINO" -name 'erpsitio_*.sql.gz' -type f -mtime +"$DIAS_RETENCAO" -print -delete | wc -l)
[ "$REMOVIDOS" -gt 0 ] && echo "removidos $REMOVIDOS backups com mais de $DIAS_RETENCAO dias"

echo "backups guardados: $(find "$DESTINO" -name 'erpsitio_*.sql.gz' | wc -l)"

# O backup local está bom e verificado; o que falhou foi a cópia externa. Sai
# com erro de propósito para o cron registrar e você perceber — mas só depois
# de tudo acima, para não perder o que já deu certo.
if [ "$FALHA_ENVIO" -ne 0 ]; then
  echo "" >&2
  echo "ATENÇÃO: o backup desta máquina está bom, mas a cópia externa falhou." >&2
  echo "         Enquanto isso não voltar, existe só uma cópia dos dados." >&2
  exit 4
fi
