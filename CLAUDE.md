# ERPSitio — contexto para o Claude Code

Sistema de gestão de fruticultura do **Sítio Santo Antônio** (Monte Alto-SP,
limão e abacate). Não é projeto de estudo: **está em produção com dados reais**
desde 30/07/2026.

> **Foco a partir de agora: melhorar o sistema.**
> A infraestrutura está montada, no ar e documentada abaixo. O trabalho daqui
> em diante é sobre o que o sistema faz pelo sítio — telas, relatórios,
> usabilidade no campo, novos controles. Só volte à infraestrutura se algo
> quebrar ou se uma melhoria realmente exigir.

## Regra que vem antes de todas

**Nunca apague registros do banco.** Propriedade, talhões, polígonos, culturas,
usuários, colheitas e lançamentos de campo são dados reais do sítio, digitados
uma vez e sem outra fonte. Antes de qualquer operação destrutiva (`DELETE`,
`TRUNCATE`, `migrate reset`, remover volume do Docker), pare e pergunte.

Referência atual: **1 propriedade, 7 talhões, 35,37 ha**. Se um comando fizer
esse número mudar sem o usuário ter pedido, algo está errado.

## Quem usa

- **Igor** (dono, ADMIN, `admin@sitio.com.br`) — painel no navegador,
  consolidação, custos, cadastros
- **Encarregado** (`encarregado@sitio.com.br`) — celular, PWA instalado,
  lançamentos diários, frequentemente **sem sinal** (daí a fila offline)

Interface toda em português do Brasil, na linguagem da operação ("operações",
"talhão", "empreiteiro", "caixas"), não em jargão de software.

---

# 1. Como as peças se comunicam

```
        CELULAR / NAVEGADOR
                |
                |  (1) abre https://sitiocostamello.com.br
                v
   +--------------------------------------+
   |  VERCEL                              |
   |  projeto "erpsitio"                  |
   |  compila apps/web e serve arquivos   |
   |  estaticos (HTML/JS/CSS) + PWA       |
   +--------------------------------------+
                |
                |  (2) o JS ja compilado chama
                |      https://api.sitiocostamello.com.br/api/v1/...
                |      levando "Authorization: Bearer <token>"
                v
   +--------------------------------------+
   |  ORACLE CLOUD  163.176.96.228        |
   |                                      |
   |  Caddy :443  (certificado Let's      |
   |     |         Encrypt, automatico)   |
   |     v                                |
   |  API :3333   (Fastify)               |
   |     |         confere o token,       |
   |     |         confere CORS_ORIGIN,   |
   |     |         aplica permissoes      |
   |     v                                |
   |  Postgres :5432                      |
   +--------------------------------------+
                |
                |  (3) todo dia 02:00 (cron do usuario ubuntu)
                v
        pg_dump -> gzip -> gpg (AES-256) -> rclone
                |
                v
        GOOGLE DRIVE / ERPSitio/backups
```

**Pontos que importam nesse desenho:**

- O navegador fala com **dois domínios diferentes** — daí o CORS existir. A API
  só responde a quem estiver em `CORS_ORIGIN`.
- **Nem a API nem o banco têm porta aberta para a internet.** Só o Caddy. Quem
  chega de fora passa obrigatoriamente por ele, em HTTPS.
- O token JWT viaja no cabeçalho `Authorization`, guardado no `localStorage`.
  **Não há cookie**, por isso não existe complicação de `SameSite`.
- Sem sinal, o app grava o lançamento no IndexedDB e envia quando a conexão
  volta, com idempotência por `clientId` (reenviar não duplica).

---

# 2. Configuração exata de cada serviço

## 2.1 Oracle Cloud

Painel: https://cloud.oracle.com — região **sa-saopaulo-1 (Brazil East)**

### Instância

| Item | Valor |
| --- | --- |
| Nome | `instance-20260730-1409` |
| Shape | `VM.Standard.E2.1.Micro` (AMD, Always Free) |
| OCPU / memória | 1 / 1 GB |
| Availability domain | `BpqJ:SA-SAOPAULO-1-AD-1` |
| Fault domain | `FAULT-DOMAIN-3` |
| Imagem | Ubuntu 22.04 |
| Disco | 50 GB + **swap de 4 GB** criado à mão |
| IP público | `163.176.96.228` |
| IP privado | `10.0.0.205` |
| Usuário | `ubuntu` |

> Escolhemos a Micro porque a ARM (`VM.Standard.A1.Flex`, 4 vCPU / 24 GB) vive
> com "Out of capacity" em São Paulo. A Micro atende folgada: ~300 MB de uso
> num total de 956 MB.

### Rede

| Item | Valor |
| --- | --- |
| VCN | `vcn-erpsitio` — CIDR `10.0.0.0/16` |
| Subnet | `subnet-publica` — CIDR `10.0.0.0/24`, pública |
| Internet Gateway | `igw-erpsitio` (habilitado) |
| Tabela de rotas | `Default Route Table for vcn-erpsitio` |
| Regra de rota | `0.0.0.0/0` → Internet Gateway |
| DNS interno | `subnetpublica.vcnerpsitio.oraclevcn.com` |

> **A regra de rota é obrigatória e não vem pronta.** Ter o Internet Gateway
> criado não basta: sem `0.0.0.0/0 -> IGW` na tabela de rotas, a instância fica
> inalcançável — nem o SSH responde. Foi exatamente o que aconteceu aqui.

### Firewall — são DUAS camadas, ambas necessárias

**(a) Security List da Oracle** — `Default Security List for vcn-erpsitio`

Entrada:

| Origem | Protocolo |
| --- | --- |
| `0.0.0.0/0` | TCP 22 (SSH) |
| `0.0.0.0/0` | TCP 80 (HTTP) |
| `0.0.0.0/0` | TCP 443 (HTTPS) |
| `0.0.0.0/0` | ICMP |
| `10.0.0.0/16` | ICMP |

Saída: `0.0.0.0/0`, todos os protocolos.

**(b) iptables dentro do Ubuntu** — a Oracle entrega o Ubuntu com iptables
fechado. Liberar só no painel não adianta:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Esquecer a camada (b) é o motivo nº 1 de "o site não abre".

### O que roda na máquina

```
/home/ubuntu/ERPSitio          clone do repositorio
  .env                         segredos (permissao 600)
  backups/                     copias locais, 30 dias
docker compose -f infra/docker-compose.micro.yml
  db     postgres:16-alpine    limite 320 MB
  api    ghcr.io/.../erpsitio-api:main   limite 320 MB
  caddy  caddy:2-alpine        limite 64 MB, unico com portas publicadas
~/.config/rclone/rclone.conf   autorizacao do Google Drive
crontab                        backup 02:00 diario; conferencia dia 1, 03:00
```

Preparação da máquina: `infra/oracle/cloud-init-micro.yaml` (Docker, gnupg,
rclone, swap, iptables, clone do repositório).

## 2.2 Domínio — registro.br

Painel: https://registro.br/painel/dominios → `sitiocostamello.com.br`

Servidores DNS: os do próprio registro.br (`a.auto.dns.br`, `b.auto.dns.br`).
A edição é feita em **CONFIGURAR ZONA DNS → MODO AVANÇADO** (o modo básico só
configura a raiz e não cria subdomínio).

| Tipo | Nome | Dados | Para quê |
| --- | --- | --- | --- |
| A | `api.sitiocostamello.com.br` | `163.176.96.228` | aponta a API para a Oracle |
| A | `sitiocostamello.com.br` | *(o que a Vercel indicar)* | raiz do site |
| CNAME | `www.sitiocostamello.com.br` | *(o que a Vercel indicar)* | www |

Cuidados aprendidos:

- O registro.br **não aceita `@` nem `*`** — escreva o nome completo.
- Depois de digitar é preciso clicar em **SALVAR ALTERAÇÕES**; o botão fica
  cinza quando não há nada pendente (ou seja, cinza = já salvo).
- Domínio recém-registrado entra em **período de transição** (~2h) e a zona não
  publica durante ele, mesmo com o registro salvo.
- Para conferir de fora, sem cache:
  `Resolve-DnsName api.sitiocostamello.com.br -Server a.auto.dns.br`

## 2.3 Vercel

Painel: https://vercel.com/dashboard → projeto **`erpsitio`**

| Configuração | Valor |
| --- | --- |
| Repositório | `AgroConsultoriaCM/ERPSitio`, branch `main` |
| Root Directory | `./` (**a raiz**, não `apps/web` nem `apps/api`) |
| Framework Preset | `Other` |
| Build Command | `npm run build --workspace apps/web` |
| Output Directory | `apps/web/dist` |
| Install Command | `npm install` |
| Variável | `VITE_API_URL = https://api.sitiocostamello.com.br/api/v1` |
| Domínios | `sitiocostamello.com.br`, `www`, `erpsitio.vercel.app` |

Os três comandos acima **vêm do `vercel.json` na raiz** e aparecem
acinzentados na interface. Não ative o lápis ao lado deles: valor digitado na
interface tem prioridade sobre o arquivo, e a configuração versionada para de
valer.

`vercel.json` também define: reescrita de todas as rotas para `index.html` (o
app é uma página só), `Cache-Control: max-age=0` no `sw.js` (senão o celular
do encarregado nunca recebe atualização) e cache eterno em `/assets`.

> **Atenção ao importar:** a Vercel sugere sozinha o diretório `apps/api` com
> preset Fastify. É o oposto do que queremos — aquilo é o backend e roda na
> Oracle.

## 2.4 Backup no Google Drive

**Rota completa do backup:**

```
Postgres (container db, na Oracle)
   | pg_dump --clean --if-exists
   v
gzip -9                                    ~13 KB hoje
   | verifica: gzip -t + procura CREATE TABLE "Talhao"
   v
gpg --symmetric --cipher-algo AES256       usa SENHA_BACKUP
   | verifica: descriptografa e testa o gzip AGORA
   v
rclone copy  ->  drive:ERPSitio/backups
   | verifica: rclone lsf confirma que o arquivo chegou
   v
Google Drive / ERPSitio / backups / erpsitio_AAAA-MM-DD_HHMM.sql.gz.gpg
```

| Item | Valor |
| --- | --- |
| Destino | `drive:ERPSitio/backups` (`RCLONE_DESTINO` no `.env`) |
| Documentação | `drive:ERPSitio/documentacao` |
| Criptografia | GPG simétrico, AES-256, senha em `SENHA_BACKUP` |
| Retenção local | 30 dias (`DIAS_RETENCAO`) |
| Retenção no Drive | 180 dias (`DIAS_RETENCAO_NUVEM`) |
| Backup | todo dia às **02:00** |
| Conferência | dia **1** de cada mês às **03:00**, restaura de verdade |
| Autorização | `~/.config/rclone/rclone.conf` no servidor |
| Log | `/var/log/erpsitio-backup.log` |

Se o envio falhar, a cópia local continua válida e o script **sai com código
4** para o cron registrar — backup remoto que parou em silêncio é o pior
cenário possível.

`verificar-backup.sh --nuvem` baixa do Drive, descriptografa, restaura num
Postgres descartável e conta o que voltou. **A produção não é tocada.**

## 2.5 GitHub

| Item | Valor |
| --- | --- |
| Repositório | https://github.com/AgroConsultoriaCM/ERPSitio (público) |
| Branch | `main` |
| Actions | `.github/workflows/imagem-api.yml` |
| Imagem publicada | `ghcr.io/agroconsultoriacm/erpsitio-api:main` |

O workflow roda quando muda `apps/api/**`, `packages/db/**`, `package.json`,
`package-lock.json`, `tsconfig.base.json` ou `infra/certs/**`. Compila em ~2
minutos. Mexer só no frontend não dispara.

---

# 3. Como fazer mudanças e colocar no ar

Este é o ciclo do dia a dia.

```
   voce edita o codigo aqui
            |
            |  git add / git commit / git push
            v
   +------------------------+
   |        GITHUB          |
   +------------------------+
        |               |
        | frontend      | API ou banco
        v               v
   +---------+     +------------------+
   | VERCEL  |     | GITHUB ACTIONS   |
   | compila |     | compila a imagem |
   | e publica     | e publica no GHCR|
   | SOZINHA |     +------------------+
   +---------+               |
        |                    | voce roda no servidor:
        |                    |   git pull && docker compose pull && up -d
        v                    v
     no ar                 no ar
```

## Mudou só o frontend (`apps/web`)

```bash
git add . && git commit -m "descricao" && git push
```

**Acabou.** A Vercel detecta o push, recompila e publica sozinha em ~2 minutos.
Acompanhe em https://vercel.com/dashboard.

## Mudou a API ou o banco (`apps/api`, `packages/db`)

Depois do push, o GitHub Actions compila a imagem (~2 min). Confira em
https://github.com/AgroConsultoriaCM/ERPSitio/actions que terminou com sucesso,
e então, **no servidor**:

```bash
ssh -i CAMINHO/DA/CHAVE ubuntu@163.176.96.228
cd ~/ERPSitio
git pull
docker compose -f infra/docker-compose.micro.yml --env-file .env pull
docker compose -f infra/docker-compose.micro.yml --env-file .env up -d
```

O `git pull` traz o compose e os scripts; o `docker compose pull` traz a
imagem nova. Migrations do Prisma rodam sozinhas quando a API sobe.

> Fazer o `up -d` **antes** de o Actions terminar sobe a imagem antiga sem
> avisar. Confira o Actions primeiro.

## Mudou o schema do banco

Gere a migration **localmente** antes de commitar:

```bash
docker compose -f infra/docker-compose.yml --env-file .env run --rm api sh -c \
  "npm install && npm run migrate:dev --workspace packages/db -- --name nome_da_mudanca"
```

Isso cria o arquivo versionado em `packages/db/prisma/migrations/`. Commite
junto com o código. No servidor ela é aplicada sozinha na subida da API.

**Antes de qualquer mudança de schema em produção, rode um backup manual.**

## Mudou uma variável de ambiente

- **Do frontend** (`VITE_API_URL`): mude na Vercel e **force um Redeploy**. O
  valor entra na compilação; sem novo build o site continua com o antigo.
- **Da API** (`.env` do servidor): edite e rode `up -d` para recriar o
  container.

## Antes de encerrar uma mudança

1. O site abre e **carrega dados** (tela em branco = quase sempre `CORS_ORIGIN`)
2. `curl https://api.sitiocostamello.com.br/health` responde `{"status":"ok"}`
3. `docker compose ... ps` mostra tudo `Up`
4. Continuam **7 talhões e 35,37 ha**

---

# 4. Arquitetura do código

Monorepo npm workspaces:

| Workspace | O que é |
| --- | --- |
| `apps/api` | Fastify + TypeScript + Zod. Toda regra de negócio mora aqui. |
| `apps/web` | React + Vite + Tailwind, PWA com service worker e fila offline (Dexie/IndexedDB) |
| `packages/db` | Prisma + PostgreSQL, 25 tabelas, migrations escritas à mão |

**Por que a regra de negócio fica no servidor:** o sistema calcula rateio de
custo por área, consumo de estoque por lote (FIFO) com custo real e margem de
colheita. São contas de dinheiro do usuário — não podem rodar no navegador.

**Por que a API não vai para a Vercel:** lá tudo vira função que sobe e morre a
cada chamada, o que briga com pool de conexões do Prisma, cache em memória e
transação de banco.

Serviços centrais em `apps/api/src/services/`: `rateio.ts`, `estoque.ts`,
`geoAreas.ts`, `permissoes.ts`, `clima.ts`.

Serviços externos gratuitos: **Esri World Imagery** (satélite nos mapas,
escolhido no lugar do Google Maps para não gerar mensalidade) e **Open-Meteo**
(previsão e histórico de chuva, sem chave de API).

## Portas

**No servidor** — só três chegam da internet:

| Porta | Serviço | Exposta? |
| --- | --- | --- |
| 22 | SSH | sim |
| 80 | Caddy (redireciona e valida certificado) | sim |
| 443 | Caddy → API | sim |
| 3333 | API (Fastify) | **não** — só na rede interna do Docker |
| 5432 | PostgreSQL | **não** — só na rede interna do Docker |

**No desenvolvimento local** (`infra/docker-compose.yml`): frontend `5173`,
API `3333`, Postgres **`5433`** (5433, não 5432, para não conflitar com um
Postgres instalado na máquina). Com `docker-compose.prod.yml`, o site sai na
`8080`. Tudo isso vem do `.env`.

---

# 5. Comandos do dia a dia

**No servidor** (`cd ~/ERPSitio`):

```bash
C="docker compose -f infra/docker-compose.micro.yml --env-file .env"

$C ps                     # o que esta de pe
$C logs -f api            # acompanhar a API
$C restart api            # reiniciar so a API
git pull && $C pull && $C up -d    # atualizar

COMPOSE_FILE=infra/docker-compose.micro.yml ./infra/scripts/backup.sh
./infra/scripts/verificar-backup.sh --nuvem
tail -30 /var/log/erpsitio-backup.log
crontab -l
```

**No desenvolvimento local:**

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml --env-file .env up -d
```

---

# 6. Segredos: onde estão

| Segredo | Onde | Observação |
| --- | --- | --- |
| Senha do Postgres, `JWT_SECRET` | `.env` do servidor (600) | geradas lá, nunca saíram |
| `SENHA_BACKUP` | `.env` do servidor + gerenciador de senhas + papel | **nunca guardar no Drive** — é o que protege os backups que estão lá |
| Autorização do Drive | `~/.config/rclone/rclone.conf` no servidor | |
| Chave SSH | máquina do usuário | ao trocar de máquina, **gerar outra**, não copiar |
| Chave de API da Oracle | `~/.oci/config` na máquina do usuário | idem |

Nada disso está no Git. Roteiro para montar outra máquina:
`drive:ERPSitio/documentacao/ERPSitio-outra-maquina.md`.

---

# 7. Armadilhas já pagas (não repita)

- **cloud-init em ASCII puro.** Um acento em comentário faz o painel da Oracle
  corromper o upload e o cloud-init descarta o arquivo INTEIRO em silêncio. E
  `runcmd` roda com `sh`, não bash — nada de `exec > >(tee ...)`.
- **Rota da subnet.** Internet Gateway criado não basta; falta
  `0.0.0.0/0 -> IGW` na tabela de rotas.
- **Workbox serializa `runtimeCaching` como texto** para dentro do `sw.js`. Uma
  função perde as variáveis de fora; use expressão regular.
- **`docker compose exec -T` consome o stdin** e engole o resto de um heredoc.
  Redirecione com `</dev/null`.
- **`localhost` dentro do container** resolve para IPv6; a API escuta IPv4. Use
  `127.0.0.1` ao testar por dentro.
- **`wget` do Alpine (busybox) não aceita `--method`** — para testar CORS, use
  `curl` num container à parte.
- **PowerShell 5.1**: sem `&&`, sem `-AsArray` no `ConvertTo-Json`; redirecionar
  stderr de programa externo vira erro falso; `.ps1` com acento precisa de BOM
  UTF-8; `Get-Content` em arquivo sem BOM corrompe acentos ao regravar.
- **Postgres em 1 GB** precisa de `shared_buffers` e `max_connections`
  reduzidos; o padrão reserva memória que a máquina não tem.
- **`CORS_ORIGIN`** precisa bater exatamente com o endereço do site, com
  `https://` e sem barra no fim.
- **`VITE_API_URL` é lido na compilação.** Mudou, precisa de novo deploy.

---

# 8. Pendências conhecidas (30/07/2026)

1. **`client_id` próprio do Google Drive.** O rclone usa hoje um `client_id`
   compartilhado que o Google desativa durante 2026. Quando cair, o envio do
   backup para. A cópia local continua e o script sai com código 4, mas convém
   resolver: https://rclone.org/drive/#making-your-own-client-id
2. **Repositório público.** Não há segredo commitado, mas com o sistema em
   operação real vale torná-lo privado. Se fizer, o servidor precisará de
   `docker login ghcr.io` — passo em `infra/oracle/README-micro.md`.
3. **Instância ARM.** `infra/oracle/tentar-instancia.ps1` tenta obter a máquina
   maior sozinho. Migrar seria o mesmo compose mais restaurar um backup.

---

# 9. Como o usuário prefere trabalhar

- Explicações em português, diretas, sem jargão desnecessário
- Verificação de verdade antes de dizer que funcionou — rodar, medir, mostrar
- Custo importa: Esri, Oracle Always Free, Open-Meteo e Vercel foram todas
  escolhas para não gerar mensalidade

# 10. Documentação do projeto

| Arquivo | Assunto |
| --- | --- |
| `README.md` | visão geral e desenvolvimento |
| `infra/oracle/README-micro.md` | **o deploy em uso**: Vercel + Oracle Micro |
| `infra/oracle/README.md` | deploy alternativo, tudo numa máquina (ARM/VPS) |
| `infra/certs/README.md` | antivírus/proxy que inspeciona HTTPS |
