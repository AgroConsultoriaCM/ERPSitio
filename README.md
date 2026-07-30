# Sítio — Gestão de Fruticultura

Sistema de gestão para propriedade rural focada em fruticultura: talhões e
safras, apontamentos de campo (atividades, insumos), estoque, colheita,
histórico de análises de solo/folha por talhão com diagnóstico automático
frente a perfis de correção por cultura, e mapa visual da propriedade.

Dois pontos de entrada sobre a mesma base de dados:

- **App do encarregado** (`/campo`): PWA instalável no celular, mobile-first,
  com fila offline para lançar atividades mesmo sem sinal — sincroniza
  sozinha quando a conexão volta.
- **Painel** (`/painel`): consolidação e cadastros mais delicados (talhões,
  safras, culturas, insumos, perfis de correção de solo, usuários), acessível
  a `ADMIN` e `GERENTE`.

## Arquitetura

Monorepo com npm workspaces:

```
apps/api      Backend Fastify + TypeScript + Prisma (PostgreSQL)
apps/web      Frontend React + Vite, PWA (site "painel" + app "campo")
packages/db   Schema Prisma compartilhado, migrations, seed
infra/        docker-compose (dev e produção), config Nginx
```

Autenticação por JWT (access token curto + refresh token) com controle de
acesso por papel (`ADMIN`, `GERENTE`, `ENCARREGADO`). Cada recurso é isolado
por `propriedadeId` no banco.

## Pré-requisitos

- [Docker](https://www.docker.com/) e Docker Compose (v2, `docker compose`)
- Não é necessário instalar Node.js na máquina — tudo roda em containers.
  (Se preferir rodar sem Docker, é necessário Node.js 20+ e PostgreSQL 16.)

## Solução de problemas: build falha com `SELF_SIGNED_CERT_IN_CHAIN`

Se o `docker compose ... up --build` falhar com erro `SELF_SIGNED_CERT_IN_CHAIN`
(ou "TLS: server certificate not trusted") ao instalar pacotes, é sinal de
que algum software na sua rede/máquina está inspecionando tráfego HTTPS
(antivírus corporativo como Kaspersky, proxy da empresa, VPN) — ele injeta um
certificado próprio que o Windows já confia, mas o container Linux não.

Solução (sem desativar a inspeção de segurança, que geralmente é política da
empresa):

1. Exporte o certificado raiz do software em questão. No Windows:
   `certmgr.msc` → "Autoridades de Certificação Raiz Confiáveis" → localize o
   certificado (ex: "Kaspersky Endpoint Security...") → botão direito → Todas
   as Tarefas → Exportar → formato "Base-64 codificado X.509 (.CER)".
2. Salve o arquivo exportado como `infra/certs/algum-nome.crt` (a pasta já é
   ignorada pelo git — nunca é versionada, é específica da sua máquina).
3. Rode o build de novo. Os Dockerfiles detectam automaticamente qualquer
   `.crt` em `infra/certs/` e passam a confiar nele.

Numa VPS limpa, sem esse tipo de inspeção de rede, essa pasta fica vazia e o
build funciona normalmente sem nenhum passo extra.

## Primeira configuração

1. Copie o arquivo de variáveis de ambiente e ajuste as senhas/segredos:

   ```bash
   cp .env.example .env
   ```

   Troque `POSTGRES_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET` e
   `SEED_ADMIN_SENHA` por valores próprios antes de ir para produção.

2. Suba o banco de dados sozinho e gere a migration inicial do Prisma (isso
   só precisa ser feito **uma vez**, na primeira vez que o projeto é
   configurado — depois disso as migrations ficam versionadas no
   repositório em `packages/db/prisma/migrations/`):

   ```bash
   docker compose -f infra/docker-compose.yml --env-file .env up -d db
   docker compose -f infra/docker-compose.yml --env-file .env run --rm api sh -c \
     "npm install && npm run generate --workspace packages/db && npm run migrate:dev --workspace packages/db -- --name init"
   ```

3. Suba o restante do ambiente de desenvolvimento:

   ```bash
   docker compose -f infra/docker-compose.yml --env-file .env up
   ```

   - API disponível em `http://localhost:3333`
   - Web (painel + campo) disponível em `http://localhost:5173`
   - O seed roda automaticamente e cria:
     - Admin: e-mail definido em `SEED_ADMIN_EMAIL`, senha em `SEED_ADMIN_SENHA`
     - Encarregado de teste: `encarregado@sitio.com.br` / `encarregado123`
     - Propriedade, culturas, tipos de atividade, insumos, 2 talhões de
       exemplo (com polígono) e 2-3 perfis de correção de solo de referência

Depois da primeira configuração, o dia a dia é só:

```bash
docker compose -f infra/docker-compose.yml --env-file .env up
```

## Estrutura de acesso (RBAC)

| Ação | ADMIN | GERENTE | ENCARREGADO |
| --- | --- | --- | --- |
| Lançar atividade de campo / colheita | sim | sim | sim |
| Ver `/campo` | sim | sim | sim |
| Ver/editar `/painel` (talhões, estoque, análises, perfis...) | sim | sim | não |
| Gerenciar usuários | sim | não | não |

## App do encarregado (PWA) no celular

1. Acesse a URL do sistema pelo navegador do celular (Chrome/Safari).
2. Faça login com o usuário do encarregado.
3. No menu do navegador, escolha "Adicionar à tela inicial" (Android) ou
   "Adicionar à Tela de Início" (iOS/Safari). O app passa a abrir como um
   aplicativo normal, com ícone próprio.
4. Sem sinal, os apontamentos ficam guardados no aparelho (indicador
   "pendente" no topo da tela) e são enviados automaticamente assim que a
   internet voltar — ou manualmente pelo botão "sincronizar".

> Limitação conhecida do MVP: apenas o fluxo de **atividades de campo**
> guarda fila offline. O registro de colheita pela tela `/campo/colheita`
> ainda exige conexão — fica como evolução futura estender a mesma fila para
> colheitas.

## Diagnóstico de solo

Em `/painel/talhoes/:id`, aba "Análises de solo/folha", o sistema compara a
análise de solo mais recente do talhão com o **perfil de correção** cadastrado
para a cultura plantada (`/painel/perfis-correcao`) e classifica cada
parâmetro (baixo/adequado/alto), além de estimar a necessidade de calagem
pela fórmula clássica de saturação por bases. Os perfis de referência do seed
são pontos de partida genéricos de literatura agronômica — **não substituem
a orientação de um responsável técnico**; ajuste-os livremente com o
conhecimento da propriedade.

## Deploy em produção

Há três caminhos, do mais recomendado ao mais simples:

| Caminho | Custo | Guia |
| --- | --- | --- |
| **Frontend na Vercel + API/banco na Oracle Micro** | grátis | [infra/oracle/README-micro.md](infra/oracle/README-micro.md) |
| Tudo numa máquina só (Oracle ARM ou VPS paga) | grátis / ~R$ 25 mês | [infra/oracle/README.md](infra/oracle/README.md) |
| Manual, sem HTTPS automático | — | seção abaixo |

O primeiro é o que está em uso: a Vercel compila e distribui o PWA, e a
máquina da Oracle roda só a API e o banco — que é onde ficam as contas de
custo, estoque e margem, longe do navegador.

### Deploy manual (VPS, mesma origem)

1. No servidor, instale Docker e Docker Compose.
2. Copie o repositório para o servidor (`git clone` ou `scp`) e o arquivo
   `.env` com valores de produção (senhas fortes, `CORS_ORIGIN` com o domínio
   real, etc.).
3. Gere a migration inicial (mesmo passo da seção anterior) apontando para o
   banco de produção, se ainda não tiver sido feito.
4. Build e subida:

   ```bash
   docker compose -f infra/docker-compose.prod.yml --env-file .env up -d --build
   ```

   - O container `web` serve os arquivos estáticos do PWA por Nginx **e**
     encaminha `/api/*` para o container `api` (mesma origem, sem problema de
     CORS). Publique a porta dele (padrão 80) atrás do seu domínio.
   - Para HTTPS, use um proxy reverso externo (ex.: outro Nginx ou Caddy no
     host, ou Cloudflare) na frente do container `web`, ou adicione
     Let's Encrypt/Certbot ao `infra/nginx/web.conf` — não incluído aqui para
     manter o setup inicial simples.
5. (Opcional) Criar o primeiro usuário admin e dados de exemplo:

   ```bash
   docker compose -f infra/docker-compose.prod.yml exec api \
     npm run seed --workspace packages/db
   ```

   Depois de criar seus próprios talhões/usuários reais, pode excluir os
   dados de exemplo (`Talhão 01/02`, perfis de referência) pelo painel.

### Atualizando o sistema depois de mudanças no schema

```bash
docker compose -f infra/docker-compose.yml --env-file .env run --rm api sh -c \
  "npm install && npm run migrate:dev --workspace packages/db -- --name <nome_da_mudanca>"
```

Isso cria uma nova migration versionada. Em produção, o container `api` roda
`prisma migrate deploy` automaticamente ao subir, aplicando migrations
pendentes sem prompt.

## O que fica fora deste MVP

- Emissão de NF-e / integração fiscal (SEFAZ).
- Telas de financeiro (contas a pagar/receber, fluxo de caixa, conciliação
  bancária) — o schema já foi desenhado para não precisar de redesenho
  quando isso entrar.
- Imagens de satélite/NDVI, monitoramento de pragas (MIP).
- Cálculo automático de dose de adubação (o diagnóstico mostra o gap frente
  ao perfil ideal, não uma receita de adubação pronta).
- Fila offline para colheita (só atividades de campo têm fila offline hoje).
- App nativo — o PWA cobre o caso de uso hoje; pode migrar para React Native
  reaproveitando a mesma API se o PWA se mostrar insuficiente em campo.

## Nota sobre este repositório

Este projeto foi montado em um ambiente sem Node.js/Docker instalados, então
o código **não foi executado/testado em runtime** neste momento — foi escrito
e revisado estaticamente. Antes de considerar o sistema pronto para uso real,
rode localmente seguindo "Primeira configuração" acima e valide o fluxo
ponta a ponta (login, criar talhão, desenhar polígono, lançar atividade
offline/online, lançar análise de solo e conferir o diagnóstico).
