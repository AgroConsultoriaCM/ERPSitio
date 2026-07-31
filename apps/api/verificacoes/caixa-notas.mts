// Confere se a caixa de notas esta acessivel e o que ha nela.
//
// Nao imprime remetente, assunto nem conteudo: so a contagem e os nomes dos
// anexos, que e o necessario para saber se o encaminhamento funcionou.
//
// Uso:  npx tsx verificacoes/caixa-notas.mts
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { readFileSync } from "node:fs";

function doEnv(chave: string): string {
  const linha = readFileSync("../../.env", "utf8")
    .split("\n")
    .find((l) => l.startsWith(chave + "="));
  if (!linha) throw new Error(`${chave} nao esta no .env`);
  // A senha de app do Google e mostrada em quatro grupos separados por espaco;
  // o servidor espera as 16 letras sem separacao.
  return linha.slice(chave.length + 1).trim().replace(/\s+/g, "");
}

const usuario = doEnv("EMAIL_NOTAS_USUARIO");
const senha = doEnv("EMAIL_NOTAS_SENHA");

const cliente = new ImapFlow({
  host: "imap.gmail.com",
  port: 993,
  secure: true,
  auth: { user: usuario, pass: senha },
  logger: false,
});

const trava = { liberar: () => {} };

try {
  console.log("conectando em imap.gmail.com como", usuario, "...");
  await cliente.connect();
  console.log("  autenticado");

  const caixa = await cliente.mailboxOpen("INBOX");
  console.log(`  INBOX: ${caixa.exists} mensagens no total`);

  if (caixa.exists === 0) {
    console.log("\nA caixa esta vazia - o encaminhamento ainda nao entregou nada.");
    process.exit(1);
  }

  // Olha as 20 mais recentes: o suficiente para saber se esta chegando.
  const inicio = Math.max(1, caixa.exists - 19);
  let comXml = 0;
  let comZip = 0;
  let semAnexo = 0;
  const nomes: string[] = [];

  for await (const msg of cliente.fetch(`${inicio}:*`, { source: true, envelope: true })) {
    const email = await simpleParser(msg.source as Buffer);
    const anexos = email.attachments ?? [];
    if (anexos.length === 0) {
      semAnexo++;
      continue;
    }
    let temXml = false;
    let temZip = false;
    for (const a of anexos) {
      const nome = (a.filename ?? "(sem nome)").toLowerCase();
      if (nome.endsWith(".xml")) temXml = true;
      if (nome.endsWith(".zip")) temZip = true;
      if (nomes.length < 12) nomes.push(a.filename ?? "(sem nome)");
    }
    if (temXml) comXml++;
    else if (temZip) comZip++;
  }

  console.log("\n=== nas 20 mensagens mais recentes ===");
  console.log(`  com anexo .xml : ${comXml}`);
  console.log(`  com anexo .zip : ${comZip}`);
  console.log(`  sem anexo      : ${semAnexo}`);

  if (nomes.length) {
    console.log("\n=== nomes de anexo encontrados ===");
    for (const n of nomes) console.log("  " + n);
  }

  console.log(
    comXml > 0
      ? "\nENCAMINHAMENTO FUNCIONANDO: ha XML chegando nesta caixa."
      : "\nAINDA SEM XML: a caixa recebe, mas nenhum anexo .xml apareceu.",
  );
  process.exit(comXml > 0 ? 0 : 2);
} catch (erro) {
  console.error("\nFALHOU:", erro instanceof Error ? erro.message : erro);
  console.error(
    "\nCausas comuns: verificacao em duas etapas desligada, senha de app " +
      "digitada errada, ou IMAP desabilitado nas configuracoes do Gmail.",
  );
  process.exit(1);
} finally {
  trava.liberar();
  await cliente.logout().catch(() => {});
}
