# O sistema no celular do encarregado

Como instalar no Android, o que funciona sem sinal e o que ainda falta.

O sistema **não é** um aplicativo da Play Store. É um PWA: o mesmo site,
instalado na tela inicial, que abre em tela cheia e continua funcionando sem
internet. Para o encarregado a diferença é invisível — ele toca um ícone. Para
o sítio a diferença é grande: sem conta de desenvolvedor, sem taxa anual, sem
aprovação de loja e sem esperar atualização ser liberada. O que subir na Vercel
está no celular dele no próximo acesso.

---

## 1. Instalar no Android

No celular, com internet, uma vez só:

1. abra `https://www.sitiocostamello.com.br` no **Chrome**
2. entre com o usuário do encarregado
3. aparece o convite **"Instalar no celular"** no topo da tela de campo — toque
   em **Instalar**

Se o convite não aparecer (o Chrome só o oferece depois de algum uso), o
caminho manual é: menu **⋮** → **Adicionar à tela inicial** → **Instalar**.

Depois disso o ícone "Sítio" fica na tela inicial. Abrindo por ele, o app entra
direto em **/campo**, sem barra de endereço.

**Atalho útil:** segurando o dedo no ícone, o Android mostra "Registrar
colheita" e "Nova operação" — vai direto ao lançamento, sem passar pela home.

### iPhone

Não há convite automático: o Safari não oferece esse recurso. O caminho é
**Compartilhar** → **Adicionar à Tela de Início**. Funciona, mas o Android é o
caminho testado.

---

## 2. O que funciona sem sinal

| Situação | Funciona? |
| --- | --- |
| Abrir o app | sim — a interface fica guardada no aparelho |
| Registrar colheita | sim — vai para a fila |
| Registrar operação com insumos | sim — vai para a fila |
| Ver os lançamentos do próprio dia | sim, inclusive os que ainda não subiram |
| Ver listas carregadas antes (talhões, insumos, executores) | sim, a última versão vista |
| **Primeiro login** | **não** — precisa de internet uma vez |
| Painel, mapa e relatórios | não — são de escritório, exigem conexão |

### Como a fila se comporta

O lançamento é gravado no próprio aparelho (IndexedDB) e some da fila só
quando o servidor confirma. Cada item leva um `clientId` próprio: se o envio
for tentado duas vezes, o servidor reconhece e **não duplica**.

O envio é tentado:

- assim que o Android avisa que a conexão voltou
- **a cada minuto**, enquanto houver item na fila
- **quando o app volta ao primeiro plano** — que é quando o encarregado
  tipicamente sai do talhão e reencontra sinal
- quando ele toca em "enviar agora"

O contador no topo mostra quantos estão esperando. Item recusado pelo servidor
(erro de validação, por exemplo) aparece em vermelho com a mensagem e um botão
para tentar de novo — **nunca é descartado em silêncio**.

Uma decisão importante: perder o sinal **não** marca o lançamento como erro. Só
resposta negativa do servidor marca. Sem isso o operador veria "erro" toda vez
que entrasse numa área sem cobertura e passaria a desconfiar do sistema.

---

## 3. O que mudou agora

- **Peso**: o primeiro download caiu de 1.107 kB para 189 kB de JavaScript. O
  mapa e os gráficos, que só o painel usa, saíram do caminho do celular e
  também do pré-carregamento do service worker (1.159 KiB → 536 KiB). Em 3G no
  meio do talhão isso é a diferença entre abrir e desistir.
- **Estado de conexão honesto**: antes o app confiava no `navigator.onLine`,
  que diz "online" com a torre fora de alcance. Agora quem decide é a chamada
  real à API.
- **Reenvio automático** periódico e ao voltar ao primeiro plano.
- **Reenviar recusados** em um toque.
- **Convite de instalação** dentro do app.
- **Manifesto**: atalhos, escopo, `id` fixo (evita o ícone duplicar) e trava em
  retrato.
- **Mapa de satélite guardado**: a imagem já vista de um talhão abre offline.

---

## 4. O que ainda falta — precisa da sua decisão

Deixei de fora tudo que mexeria em estrutura, conforme combinado.

**a) Ícone adaptativo (maskable).** O Android recorta o ícone em círculo ou
"squircle" conforme o aparelho. Os ícones atuais não têm margem de segurança,
então podem sair com a borda cortada. A correção é gerar um PNG 512×512 com o
desenho dentro dos 80% centrais e declará-lo como `purpose: "maskable"`. Não
fiz porque exigiria editar imagem, e eu chutaria o enquadramento da sua marca.

**b) Sincronização em segundo plano.** Hoje a fila anda com o app aberto. A
`Background Sync API` do Chrome permite ao Android enviar sozinho depois que o
app foi fechado, assim que o sinal voltar. É a melhoria com maior efeito
prático, e mexe no service worker — por isso parei aqui.

**c) Foto no lançamento.** Registrar praga ou ocorrência com foto é o pedido
mais comum em campo. Exige coluna nova, armazenamento de arquivo e envio na
fila offline. Mudança estrutural de verdade — mudaria banco, API e o formato da
fila.

**d) Testes automatizados.** Ao exercitar a lógica nova do clima, encontrei um
erro de projeto: um dia seco antes de uma frente estava sendo rebaixado, e a
semana ficava sem nenhum dia bom para pulverizar mesmo havendo um. Corrigi. O
projeto não tem nenhuma infraestrutura de teste; instalar uma (Vitest) é uma
decisão sua, e depois dela essas verificações passariam a rodar sozinhas.

**e) `client_id` próprio do Google Drive.** Já estava na sua lista de
pendências e continua valendo: o rclone avisa em toda execução que o
`client_id` compartilhado será desativado durante 2026. Quando cair, o backup
para de subir para o Drive (a cópia local continua, e o script sai com código
4). Instruções: <https://rclone.org/drive/#making-your-own-client-id>
