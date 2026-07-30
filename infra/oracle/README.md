# Deploy na Oracle Cloud (Always Free)

Guia para colocar o sistema no ar de graça, para sempre, numa máquina ARM da
Oracle: **4 vCPU, 24 GB de RAM, 200 GB de disco** — mais potente que a maioria
das VPS pagas.

O mesmo procedimento serve para qualquer VPS Linux (Hetzner, Contabo). Só a
parte 1 é específica da Oracle.

---

## 1. Criar a conta e a máquina

### 1.1 Conta

Cadastre-se em [oracle.com/cloud/free](https://www.oracle.com/cloud/free/).
Pedem cartão de crédito **para verificação de identidade** — os recursos
"Always Free" não são cobrados. Ainda assim, escolha o modo **Always Free** e
não faça upgrade para "Pay As You Go" sem querer.

### 1.2 Instância

**Compute → Instances → Create Instance**

| Campo | Valor |
| --- | --- |
| Image | Ubuntu 22.04 (ou 24.04) |
| Shape | **Ampere (ARM)** → `VM.Standard.A1.Flex` |
| OCPUs | 4 |
| Memória | 24 GB |
| Boot volume | 100 GB (o free vai até 200 GB) |

> **Se aparecer "Out of capacity"**: é comum na camada gratuita ARM. Tente
> outra *Availability Domain*, outra região próxima, ou repita em outro
> horário. Insista — costuma liberar.

Em **Add SSH keys**, escolha *Generate a key pair for me* e **baixe a chave
privada**. Sem ela você não entra na máquina.

Anote o **IP público** ao final.

### 1.3 Os dois firewalls (a armadilha mais comum)

A Oracle tem **duas** camadas de bloqueio. Esquecer a segunda faz o site nunca
abrir, mesmo com tudo certo:

**a) Security List (no painel da Oracle)**
Networking → Virtual Cloud Networks → sua VCN → Subnets → sua subnet →
Security Lists → Default → **Add Ingress Rules**:

| Source CIDR | Protocolo | Porta |
| --- | --- | --- |
| 0.0.0.0/0 | TCP | 80 |
| 0.0.0.0/0 | TCP | 443 |

**b) Firewall do Ubuntu (dentro da máquina)**
Depois de conectar por SSH:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 2. Domínio

Você precisa de um domínio apontando para o IP — sem ele não há HTTPS, e sem
HTTPS o PWA **não instala** no celular.

- Registre um `.com.br` no [registro.br](https://registro.br) (~R$ 40/ano) ou
  um domínio barato em qualquer registrador
- Crie um registro **A** apontando para o IP público da instância
- Espere alguns minutos e confirme: `ping seudominio.com.br` deve responder
  com o IP da Oracle

## 3. Preparar a máquina

Conecte por SSH (no Windows, use o PowerShell):

```bash
ssh -i caminho\da\chave.key ubuntu@SEU_IP
```

Instale Docker e Git:

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
sudo apt install -y git
```

Saia (`exit`) e conecte de novo, para o grupo `docker` valer.

## 4. Subir o sistema

```bash
git clone https://github.com/AgroConsultoriaCM/ERPSitio.git
cd ERPSitio
cp .env.example .env
nano .env
```

Preencha o `.env`:

```bash
POSTGRES_USER=erpsitio
POSTGRES_PASSWORD=<senha forte>
POSTGRES_DB=erpsitio
DATABASE_URL=postgresql://erpsitio:<a mesma senha>@db:5432/erpsitio?schema=public

JWT_SECRET=<string longa e aleatória>
JWT_REFRESH_SECRET=<outra string, diferente>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN_DAYS=30

DOMINIO=seudominio.com.br
EMAIL_TLS=seu@email.com
```

Para gerar os segredos:

```bash
openssl rand -hex 48
```

Suba tudo:

```bash
docker compose -f infra/docker-compose.vps.yml --env-file .env up -d --build
```

O primeiro build demora (uns 5–10 minutos na ARM). O Caddy pede o certificado
sozinho no primeiro acesso ao domínio.

Acompanhe: `docker compose -f infra/docker-compose.vps.yml logs -f`

## 5. Criar o usuário administrador

```bash
docker compose -f infra/docker-compose.vps.yml exec \
  -e SEED_ADMIN_EMAIL=voce@exemplo.com \
  -e SEED_ADMIN_SENHA='uma senha forte' \
  api npm run seed --workspace packages/db
```

Acesse `https://seudominio.com.br` e entre.

## 6. Backup automático

```bash
chmod +x infra/scripts/*.sh
crontab -e
```

Acrescente (backup diário às 2h):

```
0 2 * * * cd /home/ubuntu/ERPSitio && ./infra/scripts/backup.sh >> /var/log/erpsitio-backup.log 2>&1
```

Teste agora mesmo, sem esperar o horário:

```bash
./infra/scripts/backup.sh
```

Para restaurar: `./infra/scripts/restaurar.sh backups/erpsitio_AAAA-MM-DD_HHMM.sql.gz`

> Os backups ficam na própria máquina. **Leve uma cópia para fora** de tempos
> em tempos (baixe pelo `scp`, jogue no Google Drive) — backup no mesmo disco
> não protege contra perda da instância.

## 7. Atualizar o sistema

Quando houver mudanças no código:

```bash
cd ~/ERPSitio
git pull
docker compose -f infra/docker-compose.vps.yml --env-file .env up -d --build
```

As migrations do banco rodam sozinhas na subida da API.

---

## Checklist antes de usar para valer

- [ ] `JWT_SECRET` e `JWT_REFRESH_SECRET` gerados com `openssl rand`, nunca os
      valores de exemplo
- [ ] Senha do Postgres forte e diferente da senha do admin
- [ ] Site abre com **https://** e cadeado no navegador
- [ ] Backup rodou pelo menos uma vez e o arquivo existe em `backups/`
- [ ] Uma cópia de backup guardada fora da máquina
- [ ] PWA instalado no celular do encarregado e testado no campo
- [ ] Repositório do GitHub em modo privado

## Problemas comuns

**O site não abre e o Caddy repete erro de certificado**
DNS ainda não propagou ou a porta 80 está fechada. Confira as duas camadas de
firewall (passo 1.3) — quase sempre é a segunda, do Ubuntu.

**"Out of capacity" ao criar a instância**
Falta de máquinas ARM gratuitas na região. Tente outro *Availability Domain*,
outra região ou outro horário.

**Build muito lento ou travando**
A instância ARM tem CPU de sobra, mas o build do frontend usa bastante
memória. Com 24 GB não deve acontecer; se usar uma máquina menor, crie swap.

**Esqueci a senha do admin**
Rode o seed de novo com outro e-mail para criar um segundo administrador, ou
acesse o banco: `docker compose -f infra/docker-compose.vps.yml exec db psql -U erpsitio -d erpsitio`
