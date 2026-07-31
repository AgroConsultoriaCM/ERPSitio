# ERPSitio — contexto para o Claude Code

Sistema de gestão de fruticultura do **Sítio Santo Antônio** (limão taiti e
abacate). Não é projeto de estudo: **está em produção**, no ar em
`https://www.sitiocostamello.com.br` desde **31/07/2026**, com os cadastros
reais do sítio.

A propriedade fica **na divisa de Monte Alto e Taiaçu-SP**: 7,8 km do centro de
uma e 5,2 km da outra. Isso importa para o clima — veja a seção 4.

**Colheita intermitente.** Limão taiti não tem safra única: colhe-se em repiques
ao longo do ano. Qualquer tela que só mostre acumulado esconde o que interessa,
que é o ritmo. É por isso que o painel tem gráfico por semana.

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
                |  (1) abre https://www.sitiocostamello.com.br
                |      (a raiz sem www responde 308 e redireciona para ela)
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
fechado. Liberar só no painel não adianta.

> **A posição da regra é o que importa, não o número 6.** A cadeia INPUT tem um
> `REJECT all` no fim, e regra inserida **depois** dele não vale nada. Nesta
> máquina o REJECT estava na posição **5**, então o `-I INPUT 6` que estava
> documentado aqui caía atrás dele — as portas ficaram fechadas mesmo com as
> regras "criadas". Confira antes e insira **na posição do REJECT**:

```bash
sudo iptables -L INPUT -n --line-numbers        # ache a linha do REJECT
sudo iptables -I INPUT <linha-do-REJECT> -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT <linha-do-REJECT> -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -L INPUT -n --line-numbers        # confirme: 80 e 443 ANTES do REJECT
sudo netfilter-persistent save
```

Esquecer a camada (b), ou pôr a regra no lugar errado, é o motivo nº 1 de "o
site não abre".

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

> **`up -d` sem nome de serviço sobe os três.** Já aconteceu de `db` e `api`
> estarem de pé e o **caddy nunca ter sido iniciado** — a API respondia por
> dentro e o site não abria por fora, sem erro em log nenhum. Ao investigar
> "site fora do ar", confira `docker ps` e veja se **os três** aparecem.

**Fuso da máquina:** `America/Sao_Paulo`. Estava em UTC até 30/07/2026, o que
fazia o cron das 02:00 disparar às 23:00 de Brasília. Se recriar a instância,
rode `sudo timedatectl set-timezone America/Sao_Paulo` — senão os horários do
cron e do log não significam o que dizem.

> **Trocar o fuso não basta: reinicie o cron.** Ele lê o fuso ao iniciar e nunca
> mais reconsulta. Depois do `set-timezone`, o backup continuou disparando em
> UTC — só se percebeu porque o log marcava 23:00 e não 02:00. Sempre:
> `sudo systemctl restart cron`, e confira com `ps -o lstart= -C cron` que o
> processo é mais novo que a mudança.

## 2.2 Domínio — registro.br

Painel: https://registro.br/painel/dominios → `sitiocostamello.com.br`

A edição é feita em **CONFIGURAR ZONA DNS → MODO AVANÇADO** (o modo básico só
configura a raiz e não cria subdomínio).

**Zona configurada (31/07/2026), já publicada e propagada:**

| Tipo | Nome | Dados | Para quê |
| --- | --- | --- | --- |
| A | `api.sitiocostamello.com.br` | `163.176.96.228` | aponta a API para a Oracle |
| A | `sitiocostamello.com.br` | `216.198.79.1` | raiz → Vercel (que responde 308 para o www) |
| CNAME | `www.sitiocostamello.com.br` | `9a58cd0c11c07a2c.vercel-dns-017.com.` | onde o site realmente está |

> **Os servidores autoritativos são `a.sec.dns.br` e `c.sec.dns.br`**, não os
> `auto.dns.br`. Consultar os `auto` devolve "o nome DNS não existe" para
> registros que **estão** publicados, e leva a diagnosticar erro onde não há.
> Confirme a delegação real antes de concluir qualquer coisa:
> `curl -s https://rdap.registro.br/domain/sitiocostamello.com.br`

Conferência de fora, sem cache:

```bash
nslookup -type=A api.sitiocostamello.com.br a.sec.dns.br
```

Cuidados aprendidos:

- O campo **Nome é só o prefixo** — o painel completa com `.sitiocostamello.com.br`
  sozinho. Para a **raiz, deixe o campo vazio**; digitar o domínio inteiro cria
  `sitiocostamello.com.br.sitiocostamello.com.br`.
- O registro.br **não aceita `@` nem `*`**. A Vercel escreve `@` para a raiz —
  isso é notação dela, e traduzir para cá significa **campo vazio**.
- **SALVAR ALTERAÇÕES** cinza = nada pendente, ou seja, já salvo.
- Na tela **ALTERAR SERVIDORES DNS**, os campos vêm vazios porque a zona é do
  próprio registro.br. **Não salve essa tela em branco** — tira a delegação e
  derruba o domínio inteiro. Não é ali que se editam registros.

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
| Domínios | `www.sitiocostamello.com.br` (**é onde o site está**), raiz com 308 para o www, `erpsitio.vercel.app` |

> **Pré-visualização de branch é protegida.** Deploy de branch responde **302**
> para quem não estiver logado na conta da Vercel. Some-se a isso que o
> `CORS_ORIGIN` da API só aceita **correspondência exata** e o endereço da
> prévia **muda a cada envio** — na prática, revisar frontend pela prévia exige
> acrescentar a origem nova ao `.env` toda vez. Para mudança só de frontend,
> costuma valer mais ir direto à `main` (a Vercel publica em ~2 min) e desfazer
> com `git revert -m 1 <hash do merge>` se desagradar.

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

**Última prova de ponta a ponta: 31/07/2026.** Restaurou do Drive e devolveu
1 propriedade, 7 talhões, **35,37 ha**, 6 culturas, 4 insumos, 2 usuários.
Código de saída 0. Vale repetir de tempos em tempos — o cron já faz isso todo
dia 1, mas rodar à mão depois de qualquer mexida grande é barato.

> Os scripts usam `docker compose exec -T` por dentro. Ao chamá-los via SSH com
> heredoc, acrescente `</dev/null` ou o `exec -T` engole o resto do script.

## 2.5 GitHub

| Item | Valor |
| --- | --- |
| Repositório | https://github.com/AgroConsultoriaCM/ERPSitio (público) |
| Branch | `main` |
| Remoto | **SSH**: `git@github.com:AgroConsultoriaCM/ERPSitio.git` |
| Actions | `.github/workflows/imagem-api.yml` |
| Imagem publicada | `ghcr.io/agroconsultoriacm/erpsitio-api:main` |

O workflow roda quando muda `apps/api/**`, `packages/db/**`, `package.json`,
`package-lock.json`, `tsconfig.base.json` ou `infra/certs/**`. Compila em ~2
minutos. Mexer só no frontend não dispara.

> Instalar dependência do **frontend** mexe no `package-lock.json` e **dispara o
> workflow da API sem necessidade**. Não é problema: a imagem nova fica no GHCR
> e só chega ao servidor quando alguém roda `pull && up -d` lá.

**Autenticação: use SSH, não HTTPS.** O remoto HTTPS depende do Git Credential
Manager, que precisa abrir uma janela de login — e falha em terminal não
interativo, que é onde o agente trabalha. Com SSH o envio funciona sozinho.
Montagem em máquina nova está na seção 11.

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
docker ps                 # confira que db, api E caddy estao de pe
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

1. `npx tsc --noEmit -p apps/web/tsconfig.json` e o mesmo para `apps/api`
2. O site abre e **carrega dados** (tela em branco = quase sempre `CORS_ORIGIN`)
3. `curl https://api.sitiocostamello.com.br/health` responde `{"status":"ok"}`
4. `docker compose ... ps` mostra **os três** containers `Up` — inclusive o caddy
5. Continuam **7 talhões e 35,37 ha**
6. Mexeu no frontend: confira o tamanho do pacote no build (seção 4)

**Como saber que a Vercel realmente publicou**, sem depender de impressão: o
nome do arquivo em `/assets/index-*.js` muda a cada build. Compare antes e
depois:

```bash
curl -s https://www.sitiocostamello.com.br | grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js'
```

O navegador guarda o service worker antigo — para conferir na tela, recarregue
com **Ctrl+Shift+R**.

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

## Frontend: peças criadas em 31/07/2026

| Arquivo | O que é |
| --- | --- |
| `src/components/ui.tsx` | peças compartilhadas: `Indicador`, `Aviso`, `Tabela`, `EstadoVazio`, `Esqueleto`, `moeda`, `numero` |
| `src/components/PainelClima.tsx` | bloco de clima do painel: chuva, saldo hídrico e janela de pulverização |
| `src/components/GraficoColheita.tsx` | colheita por semana (Recharts); `agruparPorSemana` é função pura e testável |
| `src/lib/clima.ts` | contas derivadas do clima: `janelaPulverizacao`, `balancoHidrico`, `resumoClima` |
| `src/lib/useOnline.ts` | estado de conexão real (corrigido por falha de chamada, não só `navigator.onLine`) |
| `src/lib/useInstalarApp.ts` | convite de instalação no Android (`beforeinstallprompt`) |

Ícones: **lucide-react**, importados um a um (a biblioteca inteira não entra no
pacote). Paleta e animações ficam em `tailwind.config.js`; utilitários de
composição (`.cartao`, `.numero`, `.rotulo`, `.escalonar`) em `index.css`.

**Peso é requisito, não detalhe.** O celular do encarregado abre isto em 3G no
meio do talhão. As rotas do painel são carregadas sob demanda (`lazy`), e o
`globIgnores` do Workbox mantém mapa e gráficos **fora do pré-carregamento** do
service worker. Entrada ficou em ~200 kB e o precache em ~578 KiB, contra
1.107 kB e 1.159 KiB antes. Ao mexer no frontend, confira o tamanho no build.

## Clima: como a coordenada é escolhida

`GET /clima` usa a **latitude e longitude da propriedade** — nunca nome de
cidade. E essas coordenadas **não são digitadas**: a tela de Propriedade calcula
o centro do polígono desenhado (`centroideDoPoligono`, em `src/lib/geo.ts`) e o
grava a cada alteração do contorno. Por isso não existe campo de lat/long.

A grade da Open-Meteo tem **2 a 3 km**, e o sítio tem 0,35 km² — cabe inteiro
numa célula. Consequência prática: **não faz sentido "usar Monte Alto" ou "fazer
média com Taiaçu"**. Medido em 31/07/2026, sobre 21 dias:

| | Altitude atribuída | Chuva | ET0 |
| --- | --- | --- | --- |
| Sítio (centro do polígono) | 692 m | 11,7 mm | 84,6 mm |
| Monte Alto | 713 m | 13,3 mm | 84,4 mm |
| Taiaçu | 572 m | 9,5 mm | 83,5 mm |

O valor do sítio já cai naturalmente entre os das duas cidades, porque o modelo
interpola por posição. A média das cidades daria quase o mesmo número de chuva
com uma altitude 50 m pior.

**Alternativas avaliadas e descartadas:**

- **IPMet (UNESP Bauru)** — tem radar que cobre a região, e seria o melhor dado
  de chuva de curto prazo. Mas exige cadastro e **não tem API pública**: os
  produtos são página e imagem. Integrar exigiria falar com eles.
- **INMET** — tem API que funciona (`https://apiprevmet3.inmet.gov.br/previsao/3531308`,
  onde 3531308 é o código IBGE de Monte Alto). **Exige cabeçalho `User-Agent`**,
  senão devolve corpo vazio com HTTP 200. Descartada porque a previsão é texto
  ("chuva isolada"), não milímetros, não traz ET0, e a estação automática mais
  próxima está a 80–150 km.

O maior ganho de precisão continua sendo **pluviômetro no sítio**: modelo
estima, pluviômetro mede.

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
| Chave SSH **do servidor** | máquina do usuário | a atual é `ssh-key-2026-07-30`. Ao montar máquina nova, **gerar outra** e instalá-la no `authorized_keys`, em vez de copiar |
| Chave SSH **do GitHub** | máquina do usuário, separada da anterior | separadas de propósito: se uma vazar, a outra continua valendo |
| Chave de API da Oracle | `~/.oci/config` na máquina do usuário | idem |

Nenhuma dessas chaves tem passphrase, de propósito: são usadas por terminal não
interativo, e senha em chave inviabilizaria automação. A proteção é a permissão
de arquivo restrita ao usuário.

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
  UTF-8; `Get-Content` em arquivo sem BOM **exibe acentos corrompidos** (o
  arquivo está certo — não "conserte" o que não está quebrado).
- **PowerShell 5.1 e HTTPS**: `Invoke-WebRequest` negocia TLS antigo e falha com
  "a conexão subjacente estava fechada". Antes de qualquer chamada:
  `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12`
- **PowerShell 5.1 estraga aspas** ao chamar executável nativo: `-N ""` some da
  linha de comando e `-N '""'` chega como string vazia. Para `curl`,
  `ssh-keygen` e afins, use o Bash — as aspas atravessam inteiras.
- **`credential.helper` com caminho contendo espaço** quebra: o Git tenta
  executar `C:/Program`. Use o nome curto (`manager`), não o caminho completo.
- **Cache de DNS do Windows** guarda o "não existe" de antes da publicação.
  `Clear-DnsClientCache` precisa de elevação; para conferir sem cache, consulte
  o servidor autoritativo direto ou force o IP com `curl --resolve`.
- **`curl` sem `User-Agent`** recebe corpo vazio com HTTP 200 de alguns serviços
  públicos brasileiros (INMET, por exemplo). Vazio nem sempre é "não existe".
- **Postgres em 1 GB** precisa de `shared_buffers` e `max_connections`
  reduzidos; o padrão reserva memória que a máquina não tem.
- **`CORS_ORIGIN`** precisa bater exatamente com o endereço do site, com
  `https://` e sem barra no fim.
- **`VITE_API_URL` é lido na compilação.** Mudou, precisa de novo deploy.

---

# 8. Pendências conhecidas (31/07/2026)

**Infraestrutura**

1. **`client_id` próprio do Google Drive.** O rclone usa hoje um `client_id`
   compartilhado que o Google desativa durante 2026 — o aviso aparece em toda
   execução do backup. Quando cair, o envio para. A cópia local continua e o
   script sai com código 4: https://rclone.org/drive/#making-your-own-client-id
2. **Repositório público.** Não há segredo commitado, mas com o sistema em
   operação real vale torná-lo privado. Se fizer, o servidor precisará de
   `docker login ghcr.io` — passo em `infra/oracle/README-micro.md`.
3. **Instância ARM.** `infra/oracle/tentar-instancia.ps1` tenta obter a máquina
   maior sozinho. Migrar seria o mesmo compose mais restaurar um backup.

**Produto — precisam de decisão do Igor, mexem em estrutura**

4. **Ícone adaptativo (maskable)** do Android. Os ícones atuais não têm margem
   de segurança e podem sair com a borda cortada em alguns aparelhos. Exige
   gerar um PNG 512×512 com o desenho dentro dos 80% centrais.
5. **Sincronização em segundo plano** (`Background Sync API`): hoje a fila só
   anda com o app aberto. É a melhoria de maior efeito prático no campo.
6. **Foto no lançamento** de praga/ocorrência: pedido comum em campo, mas exige
   coluna nova, armazenamento de arquivo e mudança no formato da fila offline.
7. **Testes automatizados.** Não há nenhuma infraestrutura de teste. Ao
   exercitar `src/lib/clima.ts` à mão, apareceu um erro de projeto real (dia
   seco antes de uma frente era rebaixado, e a semana ficava sem nenhum dia bom
   para pulverizar). Instalar Vitest tornaria isso permanente.
8. **Telas internas no padrão antigo.** Colheitas, Operações, Estoque, Talhões e
   Cadastros ainda usam tabelas cruas, sem as peças de `components/ui.tsx`.
   Trazê-las para a mesma linguagem visual é trabalho grande e sem risco.
9. **`settings.local.json` está na raiz do repositório**, mas o Claude Code lê
   `.claude/settings.local.json`. Enquanto não for movido, as permissões
   escritas ali **não valem**. Mover é decisão do Igor — é o arquivo que define
   o que o agente pode executar sem perguntar.
10. **Centroide por média de vértices**, não de área (`src/lib/geo.ts`). Para
    contorno com vértices concentrados de um lado, o ponto desloca algumas
    centenas de metros. Irrelevante para o clima (célula de 2–3 km), afeta só o
    enquadramento inicial do mapa.

---

# 9. Como o usuário prefere trabalhar

- **Igor é engenheiro agrônomo, não desenvolvedor.** Explicações em português,
  diretas, sem jargão. Quando a interface de terceiro (registro.br, Vercel,
  GitHub Desktop) for confusa, descrever o clique, não o conceito.
- **Verificação de verdade antes de dizer que funcionou** — rodar, medir,
  mostrar o número. Ele confere. Concluir por evidência circunstancial já levou
  a diagnóstico errado aqui mais de uma vez.
- Custo importa: Esri, Oracle Always Free, Open-Meteo e Vercel foram todas
  escolhas para não gerar mensalidade.
- Ele autoriza trabalho autônomo, inclusive durante a noite. Mesmo assim: mudar
  `.env` de produção, criar recurso na Oracle e ampliar as próprias permissões
  **continuam sendo decisão dele**.

# 10. Documentação do projeto

| Arquivo | Assunto |
| --- | --- |
| `README.md` | visão geral e desenvolvimento |
| `APP-NO-CELULAR.md` | instalar no Android, o que funciona sem sinal, como a fila se comporta |
| `infra/oracle/README-micro.md` | **o deploy em uso**: Vercel + Oracle Micro |
| `infra/oracle/README.md` | deploy alternativo, tudo numa máquina (ARM/VPS) |
| `infra/certs/README.md` | antivírus/proxy que inspeciona HTTPS |

---

# 11. Montar outra máquina de trabalho

O Igor trabalha de mais de um computador. Nada de segredo está no Git, então
uma máquina nova precisa destes quatro itens. Ordem sugerida:

**1. Repositório**

```bash
git clone git@github.com:AgroConsultoriaCM/ERPSitio.git C:/ERPSitio
```

Se ainda não houver chave SSH do GitHub, clone por HTTPS e troque o remoto
depois do passo 3.

**2. Node e dependências** — Node 20 ou mais novo.

```bash
cd C:/ERPSitio
npm install
npm run generate --workspace packages/db   # cliente Prisma
npm run build --workspace packages/db      # senao o typecheck da API acusa
                                           # "Cannot find module @erpsitio/db"
```

**3. Chave SSH do GitHub** (para o agente conseguir publicar sozinho)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_github -N "" -C "erpsitio-github"
```

Cole o conteúdo de `~/.ssh/id_ed25519_github.pub` em
<https://github.com/settings/keys>. Depois, em `~/.ssh/config`:

```
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_github
  IdentitiesOnly yes
```

Confirme com `ssh -T git@github.com` — deve responder "Hi AgroConsultoriaCM!".

**4. Acesso ao servidor**

A chave privada atual do servidor não deve ser copiada entre máquinas. O certo
é gerar uma nova e autorizá-la, **a partir de uma máquina que já tem acesso**:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_sitio -N "" -C "erpsitio-servidor"
# na maquina que ja entra:
ssh -i CHAVE_ANTIGA ubuntu@163.176.96.228 "echo 'CONTEUDO_DO_.pub' >> ~/.ssh/authorized_keys"
```

No Windows, prefira o OpenSSH do sistema (`C:\Windows\System32\OpenSSH\`) ao de
outras distribuições que estejam no PATH — é o que respeita as ACLs, e o
OpenSSH recusa chave com permissão aberta. Restrinja com
`icacls CAMINHO /inheritance:r /grant:r "%USERDOMAIN%\%USERNAME%:(R)"`.

**5. Opcional: Oracle CLI**, só se for mexer em infraestrutura. `winget install
Oracle.OCI-CLI`, mais `~/.oci/config` e a chave de API gerada no painel. Ele
**não entra no PATH** — chame pelo caminho completo.

**O que NÃO precisa na máquina nova:** Docker (a produção roda na Oracle; o
compose local é só para desenvolvimento com banco próprio) e nenhum arquivo
`.env` — o de produção vive só no servidor.
