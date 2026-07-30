# ERPSitio — contexto para o Claude Code

Sistema de gestão de fruticultura do **Sítio Santo Antônio** (Monte Alto-SP,
limão e abacate). Não é um projeto de estudo: **está em produção com dados
reais** desde julho de 2026.

## Regra que vem antes de todas

**Nunca apague registros do banco.** Propriedade, talhões, polígonos, culturas,
usuários, colheitas e lançamentos de campo são dados reais do sítio, digitados
uma vez e sem outra fonte. Antes de qualquer operação destrutiva (`DELETE`,
`TRUNCATE`, `migrate reset`, remover volume do Docker), pare e pergunte.

Referência atual: **1 propriedade, 7 talhões, 35,37 ha**. Se um comando fizer
esse número mudar sem que o usuário tenha pedido, algo está errado.

## Quem usa

- **Igor** (dono, ADMIN) — painel no navegador, consolidação, custos, cadastros
- **Encarregado** — celular, PWA instalado, lançamentos diários no campo,
  frequentemente **sem sinal** (por isso a fila offline em IndexedDB)

Toda a interface é em português do Brasil, na linguagem da operação
("operações", "talhão", "empreiteiro", "caixas"), não em jargão de software.

## Arquitetura

Monorepo npm workspaces:

| Workspace | O que é |
| --- | --- |
| `apps/api` | Fastify + TypeScript + Zod. Toda regra de negócio mora aqui. |
| `apps/web` | React + Vite + Tailwind, PWA com service worker e fila offline |
| `packages/db` | Prisma + PostgreSQL (24 tabelas), migrations escritas à mão |

**Por que a regra de negócio fica no servidor:** o sistema calcula rateio de
custo por área, consumo de estoque por lote (FIFO) com custo real, e margem de
colheita. São contas de dinheiro do usuário — não podem rodar no navegador,
onde qualquer um edita.

Serviços centrais em `apps/api/src/services/`: `rateio.ts`, `estoque.ts`,
`geoAreas.ts`, `permissoes.ts`, `clima.ts`.

## Produção

Desenho dividido — guia completo em `infra/oracle/README-micro.md`:

```
sitiocostamello.com.br      -> Vercel (compila e serve o PWA)
api.sitiocostamello.com.br  -> Oracle VM.Standard.E2.1.Micro
                               Caddy (HTTPS) -> API -> Postgres
                               backup diario -> Google Drive (criptografado)
```

- A imagem da API é compilada pelo **GitHub Actions** e publicada no GHCR. A
  máquina tem 1/8 de OCPU; compilar lá levaria dezenas de minutos.
- O frontend é compilado pela Vercel. `VITE_API_URL` é lido **na compilação** —
  mudou o endereço da API, precisa de um novo deploy.
- Backup: `infra/scripts/backup.sh` (diário, 2h) e
  `infra/scripts/verificar-backup.sh --nuvem` (mensal, restaura de verdade num
  Postgres descartável para provar que o arquivo abre).

## Desenvolvimento local

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml --env-file .env up -d
```

O que **não** está no Git e pode ser preciso recriar noutra máquina:

- `.env` — copie do `.env.example` e preencha
- `infra/certs/*.crt` — só se a máquina tiver antivírus/proxy inspecionando
  HTTPS (ex.: Kaspersky), senão o build Docker falha com
  `SELF_SIGNED_CERT_IN_CHAIN`. Ver `infra/certs/README.md`.
- chave SSH do servidor, `~/.oci/config`, `~/.config/rclone/rclone.conf` —
  credenciais, nunca versionadas

## Armadilhas já pagas (não repita)

- **cloud-init em ASCII puro.** Um acento em comentário faz o painel da Oracle
  corromper o upload e o cloud-init descarta o arquivo INTEIRO em silêncio. E
  `runcmd` roda com `sh`, não bash — nada de `exec > >(tee ...)`.
- **Workbox serializa `runtimeCaching` como texto** para dentro do `sw.js`. Uma
  função perde as variáveis de fora; use expressão regular.
- **`docker compose exec -T` consome o stdin** e engole o resto de um heredoc.
  Redirecione com `</dev/null`.
- **PowerShell 5.1**: sem `&&`, sem `-AsArray` no `ConvertTo-Json`; redirecionar
  stderr de programa externo vira erro falso; arquivo `.ps1` com acento precisa
  de BOM UTF-8, senão o console embaralha.
- **Postgres em 1 GB** precisa de `shared_buffers` e `max_connections`
  reduzidos; o padrão dele reserva memória que a máquina não tem.
- **`CORS_ORIGIN`** precisa bater exatamente com o endereço do site. Errado, o
  site abre mas nenhuma tela carrega dados.

## Como o usuário prefere trabalhar

- Explicações em português, diretas, sem jargão desnecessário
- Verificação de verdade antes de dizer que funcionou — rodar, medir, mostrar
- Custo importa: a escolha por Esri em vez de Google Maps, Oracle Always Free e
  Open-Meteo foi toda para não gerar mensalidade
