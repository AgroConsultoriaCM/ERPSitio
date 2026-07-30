#!/bin/bash
# Prepara um Ubuntu recém-criado (Oracle Cloud, Hetzner, Contabo...) para
# rodar o sistema: Docker, firewall e dependências.
#
# Na máquina, depois de conectar por SSH:
#   curl -fsSL https://raw.githubusercontent.com/AgroConsultoriaCM/ERPSitio/main/infra/scripts/preparar-servidor.sh | bash
#
# Ou, se já clonou o repositório:
#   ./infra/scripts/preparar-servidor.sh
set -euo pipefail

echo "=================================================="
echo " Preparando servidor para o ERPSitio"
echo "=================================================="
echo ""

if [ "$(id -u)" -eq 0 ]; then
  echo "Rode como usuário comum (ubuntu), não como root." >&2
  echo "O script usa sudo quando precisa." >&2
  exit 1
fi

echo "[1/5] atualizando o sistema..."
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

echo "[2/5] instalando Docker e Git..."
if command -v docker >/dev/null 2>&1; then
  echo "      Docker já instalado, pulando"
else
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo apt-get install -y -qq git

echo "[3/5] liberando as portas 80 e 443 no firewall do sistema..."
# A Oracle Cloud vem com iptables fechado por padrão, ALÉM das regras no
# painel dela. Esquecer esta parte é o motivo nº 1 de "o site não abre".
if ! sudo iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null; then
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
fi
if ! sudo iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null; then
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
fi
sudo apt-get install -y -qq iptables-persistent >/dev/null 2>&1 || true
sudo netfilter-persistent save >/dev/null 2>&1 || sudo sh -c 'iptables-save > /etc/iptables/rules.v4' || true
echo "      portas 80 e 443 liberadas no sistema"

echo "[4/5] adicionando seu usuário ao grupo docker..."
sudo usermod -aG docker "$USER"

echo "[5/5] criando swap de 2 GB (segurança para o build do frontend)..."
if [ -f /swapfile ]; then
  echo "      swap já existe, pulando"
else
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  echo "      swap de 2 GB ativado"
fi

echo ""
echo "=================================================="
echo " Servidor pronto"
echo "=================================================="
echo ""
echo "IMPORTANTE: saia e conecte de novo por SSH, para o grupo docker valer."
echo ""
echo "Ainda falta liberar as portas NO PAINEL DA ORACLE (é outra camada):"
echo "  Networking -> Virtual Cloud Networks -> sua VCN -> Subnets ->"
echo "  Security Lists -> Default -> Add Ingress Rules"
echo "    0.0.0.0/0  TCP  80"
echo "    0.0.0.0/0  TCP  443"
echo ""
echo "Depois:"
echo "  git clone https://github.com/AgroConsultoriaCM/ERPSitio.git"
echo "  cd ERPSitio && cp .env.example .env && nano .env"
echo "  docker compose -f infra/docker-compose.vps.yml --env-file .env up -d --build"
echo ""
echo "Guia completo: infra/oracle/README.md"
