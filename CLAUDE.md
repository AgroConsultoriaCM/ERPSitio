# ERPSitio — contexto para o Claude Code

Sistema de gestão de fruticultura do **Sítio Santo Antônio** (Monte Alto-SP,
limão e abacate). Não é projeto de estudo: **está em produção com dados reais**
desde 30/07/2026.

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

# Onde tudo mora

## Endereços do sistema

| Endereço | O que é | Onde roda |
| --- | --- | --- |
| `https://sitiocostamello.com.br` | o site / PWA | Vercel |
| `https://www.sitiocostamello.com.br` | mesmo site | Vercel |
| `https://erpsitio.vercel.app` | mesmo site, endereço alternativo | Vercel |
| `https://api.sitiocostamello.com.br` | a API | Oracle |
| `https://api.sitiocostamello.com.br/health` | health check, responde `{"status":"ok"}` | Oracle |

## Painéis para administrar

| Painel | Endereço | Para quê |
| --- | --- | --- |
| Vercel | https://vercel.com/dashboard | projeto `erpsitio`; deploys, variáveis, domínios |
| Oracle Cloud | https://cloud.oracle.com (região **sa-saopaulo-1**) | instância, rede, firewall |
| GitHub | https://github.com/AgroConsultoriaCM/ERPSitio | código |
| GitHub Actions | https://github.com/AgroConsultoriaCM/ERPSitio/actions | compila a imagem da API |
| GHCR | https://github.com/orgs/AgroConsultoriaCM/packages | imagem `erpsitio-api` publicada |
| registro.br | https://registro.br/painel/dominios | DNS do domínio |
| Google Drive | https://drive.google.com → pasta `ERPSitio` | backups e documentação |

## Servidor

```
Oracle VM.Standard.E2.1.Micro (Always Free)
IP publico  163.176.96.228
regiao      sa-saopaulo-1
usuario     ubuntu
projeto     /home/ubuntu/ERPSitio
recursos    1 GB de RAM, 1/8 OCPU, 50 GB, swap de 4 GB
```

Acesso: `ssh -i CAMINHO/DA/CHAVE ubuntu@163.176.96.228`

## Portas

**No servidor** — só três chegam da internet, e há **duas camadas** de firewall
(Security List no painel da Oracle **e** iptables no Ubuntu). Esquecer a
segunda é o motivo nº 1 de "o site não abre".

| Porta | Serviço | Exposta? |
| --- | --- | --- |
| 22 | SSH | sim |
| 80 | Caddy (redireciona e valida certificado) | sim |
| 443 | Caddy → API | sim |
| 3333 | API (Fastify) | **não** — só na rede interna do Docker |
| 5432 | PostgreSQL | **não** — só na rede interna do Docker |

Banco e API nunca ficam acessíveis de fora: quem fala com a internet é só o
Caddy.

**No desenvolvimento local** (`infra/docker-compose.yml`):

| Porta | Serviço |
| --- | --- |
| 5173 | frontend (Vite) |
| 3333 | API |
| **5433** | PostgreSQL — 5433, **não** 5432, para não conflitar com um Postgres instalado na máquina |

Com `infra/docker-compose.prod.yml` (produção simulada local), o site sai na
**8080**. Todas essas portas vêm do `.env` (`WEB_PORT`, `API_PORT`,
`POSTGRES_PORT`).

## Fluxo de produção

```
   celular / navegador
           |
           |  https  (443)
           v
   +--------------------+
   |      VERCEL        |  compila o React a cada push, distribui o PWA
   +--------------------+
           |
           |  https  (443)   api.sitiocostamello.com.br
           v
   +----------------------------------------------+
   |  ORACLE  163.176.96.228                      |
   |                                              |
   |  Caddy :443  ->  API :3333  ->  Postgres :5432|
   |  (TLS automatico)   (interno)      (interno)  |
   +----------------------------------------------+
           |
           |  todo dia 02:00, criptografado com AES-256
           v
   Google Drive / ERPSitio/backups
```

## Como cada parte é atualizada

| Mudou | O que acontece | Precisa fazer algo? |
| --- | --- | --- |
| `apps/web` | Vercel recompila sozinha ao dar push | não |
| `apps/api` ou `packages/db` | GitHub Actions publica imagem nova no GHCR | sim: `pull` + `up -d` no servidor |
| `.env` do servidor | — | `up -d` para aplicar |
| `vercel.json` | Vercel relê no próximo deploy | não |

Migrations do Prisma rodam sozinhas quando a API sobe (`migrate deploy`).

---

# Arquitetura

Monorepo npm workspaces:

| Workspace | O que é |
| --- | --- |
| `apps/api` | Fastify + TypeScript + Zod. Toda regra de negócio mora aqui. |
| `apps/web` | React + Vite + Tailwind, PWA com service worker e fila offline (Dexie/IndexedDB) |
| `packages/db` | Prisma + PostgreSQL, 25 tabelas, migrations escritas à mão |

**Por que a regra de negócio fica no servidor:** o sistema calcula rateio de
custo por área, consumo de estoque por lote (FIFO) com custo real, e margem de
colheita. São contas de dinheiro do usuário — não podem rodar no navegador,
onde qualquer um edita.

**Por que a API não vai para a Vercel:** lá tudo vira função que sobe e morre a
cada chamada, o que briga com pool de conexões do Prisma, cache em memória e
transação de banco.

Serviços centrais em `apps/api/src/services/`: `rateio.ts`, `estoque.ts`,
`geoAreas.ts`, `permissoes.ts`, `clima.ts`.

Serviços externos gratuitos em uso: **Esri World Imagery** (satélite nos mapas,
escolhido no lugar do Google Maps para não gerar mensalidade) e **Open-Meteo**
(previsão e histórico de chuva, sem chave de API).

---

# Comandos do dia a dia

**No servidor** (`cd ~/ERPSitio`):

```bash
C="docker compose -f infra/docker-compose.micro.yml --env-file .env"

$C ps                     # o que esta de pe
$C logs -f api            # acompanhar a API
$C restart api            # reiniciar so a API
git pull && $C pull && $C up -d    # atualizar o sistema

# backup manual
COMPOSE_FILE=infra/docker-compose.micro.yml ./infra/scripts/backup.sh

# provar que o backup do Drive abre e restaura (nao toca na producao)
./infra/scripts/verificar-backup.sh --nuvem

tail -30 /var/log/erpsitio-backup.log
crontab -l                # backup 02:00 diario; conferencia dia 1, 03:00
```

**No desenvolvimento local:**

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml --env-file .env up -d
```

---

# Segredos: onde estão

| Segredo | Onde | Observação |
| --- | --- | --- |
| Senha do Postgres, `JWT_SECRET` | `.env` do servidor (permissão 600) | geradas na máquina, nunca saíram de lá |
| `SENHA_BACKUP` | `.env` do servidor + gerenciador de senhas + papel | **nunca guardar no Drive** — é o que protege os backups que estão lá |
| Autorização do Drive | `~/.config/rclone/rclone.conf` no servidor | |
| Chave SSH | máquina do usuário | ao trocar de máquina, **gerar outra**, não copiar |
| Chave de API da Oracle | `~/.oci/config` na máquina do usuário | idem |

Nada disso está no Git. Ao montar outra máquina, o roteiro está no Drive em
`ERPSitio/documentacao/ERPSitio-outra-maquina.md`.

O que **não** está versionado e pode faltar noutra máquina: `.env`,
`infra/certs/*.crt` (só necessário se o antivírus inspecionar HTTPS — ver
`infra/certs/README.md`), e as credenciais acima.

---

# Armadilhas já pagas (não repita)

- **cloud-init em ASCII puro.** Um acento em comentário faz o painel da Oracle
  corromper o upload e o cloud-init descarta o arquivo INTEIRO em silêncio. E
  `runcmd` roda com `sh`, não bash — nada de `exec > >(tee ...)`.
- **Rota da subnet.** Ter Internet Gateway não basta: a tabela de rotas da
  subnet precisa de `0.0.0.0/0 -> IGW`, senão nem o SSH responde.
- **Workbox serializa `runtimeCaching` como texto** para dentro do `sw.js`. Uma
  função perde as variáveis de fora; use expressão regular.
- **`docker compose exec -T` consome o stdin** e engole o resto de um heredoc.
  Redirecione com `</dev/null`.
- **`localhost` dentro do container** resolve para IPv6; a API escuta em IPv4.
  Use `127.0.0.1` ao testar por dentro.
- **`wget` do Alpine (busybox) não aceita `--method`** — para testar CORS use
  `curl` num container à parte.
- **PowerShell 5.1**: sem `&&`, sem `-AsArray` no `ConvertTo-Json`; redirecionar
  stderr de programa externo vira erro falso; `.ps1` com acento precisa de BOM
  UTF-8; ler arquivo sem BOM com `Get-Content` corrompe acentos ao regravar.
- **Postgres em 1 GB** precisa de `shared_buffers` e `max_connections`
  reduzidos; o padrão reserva memória que a máquina não tem.
- **`CORS_ORIGIN`** precisa bater exatamente com o endereço do site, com
  `https://` e sem barra no fim. Errado, o site abre mas nenhuma tela carrega.
- **`VITE_API_URL` é lido na compilação**, não em tempo de execução. Mudou o
  endereço da API, precisa de novo deploy na Vercel.

---

# Pendências conhecidas (30/07/2026)

1. **`client_id` próprio do Google Drive.** O rclone usa hoje um `client_id`
   compartilhado que o Google desativa durante 2026. Quando cair, o envio do
   backup para o Drive para. A cópia local continua e o script sai com código 4,
   mas convém resolver: https://rclone.org/drive/#making-your-own-client-id
2. **Repositório público.** Não há segredo commitado, mas com o sistema em
   operação real vale torná-lo privado. Se fizer, a máquina precisará de
   `docker login ghcr.io` — passo documentado em `infra/oracle/README-micro.md`.
3. **Instância ARM.** A atual é a Micro (1 GB), que atende folgada (~300 MB em
   uso). A ARM do Always Free (4 vCPU, 24 GB) vive esgotada;
   `infra/oracle/tentar-instancia.ps1` tenta obtê-la sozinho. Migrar seria o
   mesmo compose mais restaurar um backup.

---

# Como o usuário prefere trabalhar

- Explicações em português, diretas, sem jargão desnecessário
- Verificação de verdade antes de dizer que funcionou — rodar, medir, mostrar
- Custo importa: Esri em vez de Google Maps, Oracle Always Free, Open-Meteo e
  Vercel foram todas escolhas para não gerar mensalidade

# Documentação do projeto

| Arquivo | Assunto |
| --- | --- |
| `README.md` | visão geral e desenvolvimento |
| `infra/oracle/README-micro.md` | **o deploy em uso**: Vercel + Oracle Micro |
| `infra/oracle/README.md` | deploy alternativo, tudo numa máquina (ARM/VPS) |
| `infra/certs/README.md` | antivírus/proxy que inspeciona HTTPS |
