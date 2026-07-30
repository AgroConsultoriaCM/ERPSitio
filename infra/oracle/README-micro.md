# Deploy dividido: frontend na Vercel, API e banco na Oracle

Este é o caminho para colocar o sistema no ar **de graça**, sem depender da
instância ARM que vive esgotada.

Se um dia a ARM liberar, dá para migrar só a parte da Oracle — o frontend nem
fica sabendo. O guia da ARM continua em [README.md](README.md).

## O desenho

```
    celular / navegador
            |
            |  https://sitiocostamello.com.br          (o site, o PWA)
            v
    +-------------------+
    |      VERCEL       |   compila o React e distribui
    +-------------------+
            |
            |  https://api.sitiocostamello.com.br      (as chamadas de dados)
            v
    +-------------------------------------+
    |   ORACLE  VM.Standard.E2.1.Micro    |
    |   Caddy (HTTPS)  ->  API  ->  banco |
    +-------------------------------------+
            |
            |  backup diário, criptografado
            v
      Google Drive
```

**Por que dividido:** a Micro tem 1 GB de RAM e 1/8 de OCPU. Compilar o
frontend lá dentro seria sofrido. A Vercel compila de graça e ainda distribui
o site rápido. Sobra a máquina inteira para o que realmente precisa estar num
servidor seu: o banco e as contas de dinheiro.

**Por que a API não vai junto para a Vercel:** lá tudo vira função que sobe e
morre a cada chamada. Nosso sistema calcula rateio de custo, consumo de estoque
por lote (FIFO) e margem de colheita — isso precisa de um processo de pé, com
transação de banco de verdade.

---

## 1. Criar a instância na Oracle

**Compute → Instances → Create Instance**

| Campo | Valor |
| --- | --- |
| Image | Ubuntu 22.04 |
| Shape | **VM.Standard.E2.1.Micro** (aba *AMD*, não Ampere) |
| OCPU / memória | fixos: 1/8 OCPU, 1 GB |
| Boot volume | 50 GB |

> Este shape é o que **tem capacidade**. O "Out of capacity" que você vem
> tomando é exclusividade do Ampere (ARM). O Always Free dá direito a **duas**
> instâncias Micro.

Em **Initialization script**, envie o arquivo
[`cloud-init-micro.yaml`](cloud-init-micro.yaml). Ele já instala Docker, gnupg,
rclone, cria 4 GB de swap e libera o firewall do Ubuntu.

Em **Add SSH keys**, *Generate a key pair for me* e **baixe a chave privada**.

Anote o **IP público**.

### Os dois firewalls

Liberar só um dos dois é o motivo nº 1 de "o site não abre". O cloud-init já
cuidou do lado do Ubuntu; falta o painel:

Networking → Virtual Cloud Networks → sua VCN → Subnets → sua subnet →
Security Lists → Default → **Add Ingress Rules**:

| Source CIDR | Protocolo | Porta |
| --- | --- | --- |
| 0.0.0.0/0 | TCP | 80 |
| 0.0.0.0/0 | TCP | 443 |

## 2. DNS: dois registros

No painel do seu domínio (registro.br ou onde comprou):

| Tipo | Nome | Valor |
| --- | --- | --- |
| A | `api` | IP público da Oracle |
| — | raiz e `www` | o que a Vercel mandar (passo 5) |

O `api.sitiocostamello.com.br` é o único que aponta para a Oracle. Confira:

```bash
ping api.sitiocostamello.com.br
```

## 3. Configurar e subir a API

Conecte por SSH:

```bash
ssh -i caminho\da\chave.key ubuntu@SEU_IP
```

O cloud-init já clonou o repositório. Crie o `.env`:

```bash
cd ~/ERPSitio
cp .env.example .env
nano .env
```

Preencha:

```bash
POSTGRES_USER=erpsitio
POSTGRES_PASSWORD=<senha forte>
POSTGRES_DB=erpsitio
DATABASE_URL=postgresql://erpsitio:<a mesma senha>@db:5432/erpsitio?schema=public

JWT_SECRET=<string longa e aleatória>
JWT_REFRESH_SECRET=<outra, diferente>

DOMINIO_API=api.sitiocostamello.com.br
EMAIL_TLS=seu@email.com
CORS_ORIGIN=https://sitiocostamello.com.br,https://www.sitiocostamello.com.br
```

Gere os segredos com `openssl rand -hex 48`.

> `CORS_ORIGIN` precisa bater **exatamente** com o endereço do site: com
> `https://`, sem barra no fim. Se estiver errado, o site abre mas nenhuma tela
> carrega dados, e o navegador reclama de CORS no console.

### Baixar a imagem da API

O GitHub Actions compila a imagem a cada mudança na API. Como o repositório é
privado, a máquina precisa se identificar para baixar:

1. No GitHub: **Settings → Developer settings → Personal access tokens →
   Tokens (classic) → Generate new token**
2. Marque só **`read:packages`**
3. Copie o token e, no servidor:

```bash
echo "SEU_TOKEN" | docker login ghcr.io -u SEU_USUARIO_GITHUB --password-stdin
```

Agora suba:

```bash
docker compose -f infra/docker-compose.micro.yml --env-file .env pull
docker compose -f infra/docker-compose.micro.yml --env-file .env up -d
```

O Caddy pede o certificado sozinho no primeiro acesso. Confira:

```bash
curl https://api.sitiocostamello.com.br/health
```

Deve responder `{"status":"ok"}`.

## 4. Criar o administrador

```bash
docker compose -f infra/docker-compose.micro.yml --env-file .env exec \
  -e SEED_ADMIN_EMAIL=voce@exemplo.com \
  -e SEED_ADMIN_SENHA='uma senha forte' \
  api npm run seed --workspace packages/db
```

## 5. Frontend na Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → importe o
   repositório `ERPSitio`
2. A Vercel lê o [`vercel.json`](../../vercel.json) da raiz e já sabe compilar
   o workspace certo — **não mexa** em Framework Preset nem em Root Directory
3. Em **Environment Variables**, adicione:

   | Name | Value |
   | --- | --- |
   | `VITE_API_URL` | `https://api.sitiocostamello.com.br/api/v1` |

   Marque para *Production*, *Preview* e *Development*.
4. **Deploy**
5. Depois: **Settings → Domains** → adicione `sitiocostamello.com.br`. A Vercel
   mostra os registros de DNS para criar no seu registrador.

> `VITE_API_URL` é lido **na compilação**, não na hora de acessar. Se mudar
> esse valor depois, é preciso mandar a Vercel recompilar (**Deployments → …
> → Redeploy**), senão o site continua chamando o endereço antigo.

## 6. Backup no Google Drive

### Configurar o rclone

O rclone precisa de uma autorização do Google, e isso pede um navegador — que
o servidor não tem. Então autoriza-se **no seu PC** e cola-se o resultado lá.

**No seu computador** (PowerShell), instale e rode:

```powershell
winget install Rclone.Rclone
rclone authorize "drive"
```

Abre o navegador, você escolhe a conta e autoriza. O rclone imprime um bloco
começando com `{"access_token":...}`. **Copie ele inteiro.**

**No servidor:**

```bash
rclone config
```

- `n` (new remote)
- name: **drive**
- storage: **drive**
- client_id / client_secret: deixe em branco (Enter)
- scope: **1** (acesso completo)
- root_folder_id, service_account: em branco
- Edit advanced config: **n**
- Use web browser to automatically authenticate: **n**
- *Enter verification code*: **cole o bloco copiado do seu PC**
- Configure this as a Shared Drive: **n**
- `y` para confirmar, `q` para sair

Teste:

```bash
rclone mkdir drive:ERPSitio/backups
rclone lsd drive:ERPSitio
```

### Ligar no backup

Acrescente ao `.env`:

```bash
RCLONE_DESTINO=drive:ERPSitio/backups
SENHA_BACKUP=<uma senha longa, só para o backup>
```

> **A `SENHA_BACKUP` é a coisa mais importante deste arquivo.** É ela que abre
> o backup no dia em que você tiver perdido tudo o mais. Guarde no gerenciador
> de senhas **e escrita num papel**. Se perder, os backups viram lixo — nem eu
> nem ninguém consegue abrir.

Teste agora:

```bash
./infra/scripts/backup.sh
```

Deve terminar com `cópia externa confirmada`. Abra o Drive no celular: o
arquivo `.sql.gz.gpg` tem que estar lá.

### Provar que o backup abre

```bash
./infra/scripts/verificar-backup.sh --nuvem
```

Ele baixa o backup do Drive, descriptografa, restaura num Postgres descartável
e conta o que voltou. É este comando que responde *"se eu perder tudo hoje, eu
consigo voltar?"*. O banco de produção não é tocado.

## 7. Agendar

```bash
crontab -e
```

```
# backup todo dia às 2h
0 2 * * * cd /home/ubuntu/ERPSitio && ./infra/scripts/backup.sh >> /var/log/erpsitio-backup.log 2>&1

# no dia 1 de cada mês, provar que o backup do Drive abre
0 3 1 * * cd /home/ubuntu/ERPSitio && ./infra/scripts/verificar-backup.sh --nuvem >> /var/log/erpsitio-backup.log 2>&1
```

Confira o log de vez em quando: `tail -30 /var/log/erpsitio-backup.log`

## 8. Atualizar o sistema

**Mudou o frontend:** nada a fazer. A Vercel recompila sozinha a cada push.

**Mudou a API ou o banco:** o GitHub Actions publica a imagem nova; depois, no
servidor:

```bash
cd ~/ERPSitio && git pull
docker compose -f infra/docker-compose.micro.yml --env-file .env pull
docker compose -f infra/docker-compose.micro.yml --env-file .env up -d
```

As migrations rodam sozinhas quando a API sobe.

---

## Checklist antes de usar para valer

- [ ] `https://api.sitiocostamello.com.br/health` responde com cadeado no navegador
- [ ] `https://sitiocostamello.com.br` abre e **carrega dados** (se abrir mas vier
      vazio, o `CORS_ORIGIN` está diferente do endereço do site)
- [ ] Login funciona e o menu respeita as permissões
- [ ] `backup.sh` terminou com "cópia externa confirmada"
- [ ] O arquivo aparece no seu Google Drive
- [ ] `verificar-backup.sh --nuvem` restaurou e mostrou os 7 talhões
- [ ] `SENHA_BACKUP` guardada no gerenciador de senhas **e** no papel
- [ ] PWA instalado no celular do encarregado e testado no campo, offline
- [ ] Repositório do GitHub em modo privado

## Problemas comuns

**O site abre mas todas as telas ficam vazias**
É CORS. Veja o console do navegador (F12). O `CORS_ORIGIN` no `.env` da Oracle
precisa ser idêntico ao endereço do site. Depois de corrigir:
`docker compose -f infra/docker-compose.micro.yml --env-file .env up -d`

**O site continua chamando o endereço antigo da API**
`VITE_API_URL` entra na compilação. Force um *Redeploy* na Vercel.

**O Caddy não consegue o certificado**
DNS ainda não propagou ou a porta 80 está fechada. Confira as **duas** camadas
de firewall (passo 1).

**A API reinicia sozinha de tempos em tempos**
Falta de memória. Confira com `free -h` se o swap está ativo e com
`docker stats` quem está consumindo. Os limites do
`docker-compose.micro.yml` foram calculados para 1 GB — se você mexeu neles,
volte aos valores originais.

**A Oracle avisou que vai recuperar a instância por ociosidade**
Acontece no Always Free com máquinas pouco usadas. É mais um motivo para o
backup no Drive estar funcionando. Acessar o sistema todo dia já costuma
resolver.
