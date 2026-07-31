// Leva os XML que chegaram na caixa de e-mail para a API.
//
// E o ensaio da rotina automatica: por enquanto rodado a mao, mas ja com o
// comportamento definitivo - a nota entra como PENDENTE e nao toca no estoque.
//
// Uso:
//   npx tsx verificacoes/enviar-caixa-para-api.mts <url-da-api> <email> <senha>
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { readFileSync } from "node:fs";

const [API, USUARIO, SENHA] = process.argv.slice(2);
if (!API || !USUARIO || !SENHA) {
  console.error("uso: <url-da-api> <email> <senha>");
  process.exit(1);
}

function doEnv(chave: string): string {
  const linha = readFileSync("../../.env", "utf8")
    .split("\n")
    .find((l) => l.startsWith(chave + "="));
  if (!linha) throw new Error(`${chave} nao esta no .env`);
  return linha.slice(chave.length + 1).trim().replace(/\s+/g, "");
}

const login = await fetch(`${API}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: USUARIO, senha: SENHA }),
});
if (!login.ok) {
  console.error("nao consegui entrar na API:", login.status);
  process.exit(1);
}
const { accessToken } = (await login.json()) as { accessToken: string };
console.log("autenticado na API\n");

const cliente = new ImapFlow({
  host: "imap.gmail.com",
  port: 993,
  secure: true,
  auth: { user: doEnv("EMAIL_NOTAS_USUARIO"), pass: doEnv("EMAIL_NOTAS_SENHA") },
  logger: false,
});

await cliente.connect();
const caixa = await cliente.mailboxOpen("INBOX", { readOnly: true });

let novas = 0;
let repetidas = 0;
const recusadas: string[] = [];

if (caixa.exists > 0) {
  const inicio = Math.max(1, caixa.exists - 49);
  for await (const msg of cliente.fetch(`${inicio}:*`, { source: true })) {
    const email = await simpleParser(msg.source as Buffer);
    for (const anexo of email.attachments ?? []) {
      const nome = anexo.filename ?? "";
      if (!nome.toLowerCase().endsWith(".xml")) continue;

      const resposta = await fetch(`${API}/notas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ xml: anexo.content.toString("utf8"), nomeArquivo: nome }),
      });
      const corpo = (await resposta.json()) as Record<string, unknown>;

      if (!resposta.ok) {
        recusadas.push(`${nome}: ${corpo.message ?? resposta.status}`);
        continue;
      }
      if (corpo.jaExistia) {
        repetidas++;
      } else {
        novas++;
        console.log(
          `  + ${corpo.numero}/${corpo.serie}  ${String(corpo.nomeEmitente).slice(0, 34).padEnd(36)}` +
            `R$ ${Number(corpo.valorTotal).toFixed(2).padStart(10)}  p/ ${corpo.nomeDestinatario}`,
        );
      }
    }
  }
}

await cliente.logout();
console.log("\n=== resumo ===");
console.log(`  notas novas      : ${novas}`);
console.log(`  ja estavam la    : ${repetidas}`);
console.log(`  recusadas        : ${recusadas.length}`);
for (const r of recusadas) console.log(`     ${r}`);
