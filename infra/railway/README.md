# Deploy no Railway

Passo a passo para colocar o sistema no ar. São **três serviços** no mesmo
projeto Railway: banco, API e site.

> Cada `git push` na branch `main` dispara um novo deploy automaticamente.

---

## 1. Banco de dados

No projeto Railway: **+ New → Database → PostgreSQL**.

Railway cria a variável `DATABASE_URL` automaticamente — você vai referenciá-la
no serviço da API no passo seguinte.

## 2. Serviço da API

**+ New → GitHub Repo → AgroConsultoriaCM/ERPSitio**

Em **Settings** do serviço:

| Campo | Valor |
| --- | --- |
| Service Name | `api` |
| Root Directory | *(deixe vazio — o build usa a raiz do monorepo)* |
| Dockerfile Path | `apps/api/Dockerfile` |
| Custom Start Command | `node_modules/.bin/prisma migrate deploy --schema packages/db/prisma/schema.prisma && node apps/api/dist/server.js` |
| Healthcheck Path | `/health` |

Em **Variables**:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<gere uma string longa e aleatória>
JWT_REFRESH_SECRET=<outra string longa e aleatória, diferente>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN_DAYS=30
CORS_ORIGIN=https://<domínio-do-site>
```

> `${{Postgres.DATABASE_URL}}` é uma referência do Railway: ele preenche
> sozinho com os dados do banco criado no passo 1.
>
> Para gerar os segredos, rode no seu computador:
> `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

**Não** gere domínio público para a API: o site fala com ela pela rede privada
do Railway, e manter a API fechada reduz a superfície de ataque.

## 3. Serviço do site

**+ New → GitHub Repo → o mesmo repositório**

Em **Settings**:

| Campo | Valor |
| --- | --- |
| Service Name | `web` |
| Dockerfile Path | `apps/web/Dockerfile` |

Em **Variables**:

```
API_UPSTREAM=${{api.RAILWAY_PRIVATE_DOMAIN}}:3333
```

Em **Settings → Networking → Public Networking**: gere o domínio. É esse
endereço que o encarregado vai abrir no celular.

Depois de gerar o domínio, volte ao serviço `api` e ajuste `CORS_ORIGIN` para
ele.

## 4. Primeiro acesso

As migrations rodam sozinhas no start da API. Para criar o usuário
administrador inicial, abra o terminal do serviço `api` no Railway
(**Deployments → ⋮ → Shell**) e rode:

```
SEED_ADMIN_EMAIL=voce@exemplo.com SEED_ADMIN_SENHA='uma senha forte' npm run seed --workspace packages/db
```

O seed também cria culturas, tipos de operação e insumos de exemplo. Você pode
apagar o que não usar pelo painel.

---

## Checklist antes de usar para valer

- [ ] `JWT_SECRET` e `JWT_REFRESH_SECRET` são strings longas e aleatórias
      (nunca os valores de exemplo do `.env.example`)
- [ ] Senha do usuário admin trocada, diferente da usada no seed
- [ ] `CORS_ORIGIN` aponta para o domínio real do site, não `*`
- [ ] API **sem** domínio público
- [ ] Backup do Postgres ativado no Railway
- [ ] Testada a instalação do PWA no celular do encarregado
      (Chrome → menu → "Instalar aplicativo")

## Custo

No tamanho deste sistema (uma propriedade, poucos usuários), o consumo tende a
ficar na faixa de US$ 5–15/mês. Acompanhe em **Usage** no painel do Railway nos
primeiros dias — o custo é por recurso consumido, não fixo.

## Migrar para uma VPS depois

Nada aqui prende o projeto ao Railway: o `infra/docker-compose.prod.yml`
continua funcionando em qualquer servidor com Docker. Para migrar, basta um
dump do Postgres e subir os containers na VPS.
