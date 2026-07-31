// Junta as duas metades: busca os XML que chegaram na caixa e passa cada um
// pelo leitor de NF-e. E o ensaio do que a rotina automatica vai fazer.
//
// Uso:  npx tsx verificacoes/ler-notas-da-caixa.mts
//
// Nao imprime remetente, assunto nem corpo do e-mail - so o que foi entendido
// das notas.
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { readFileSync } from "node:fs";
import { lerXmlNfe, conferirTotal, XmlInvalidoError } from "../src/services/nfe.js";

function doEnv(chave: string): string {
  const linha = readFileSync("../../.env", "utf8")
    .split("\n")
    .find((l) => l.startsWith(chave + "="));
  if (!linha) throw new Error(`${chave} nao esta no .env`);
  return linha.slice(chave.length + 1).trim().replace(/\s+/g, "");
}

const cliente = new ImapFlow({
  host: "imap.gmail.com",
  port: 993,
  secure: true,
  auth: { user: doEnv("EMAIL_NOTAS_USUARIO"), pass: doEnv("EMAIL_NOTAS_SENHA") },
  logger: false,
});

await cliente.connect();
const caixa = await cliente.mailboxOpen("INBOX", { readOnly: true });
console.log(`caixa aberta: ${caixa.exists} mensagens\n`);

let lidas = 0;
let recusadas = 0;
const chaves = new Set<string>();

if (caixa.exists > 0) {
  const inicio = Math.max(1, caixa.exists - 29);
  for await (const msg of cliente.fetch(`${inicio}:*`, { source: true })) {
    const email = await simpleParser(msg.source as Buffer);
    for (const anexo of email.attachments ?? []) {
      const nome = anexo.filename ?? "";
      if (!nome.toLowerCase().endsWith(".xml")) continue;

      try {
        const nota = lerXmlNfe(anexo.content.toString("utf8"));
        const t = conferirTotal(nota);
        lidas++;

        // Chave repetida = a mesma nota chegou duas vezes (reenvio, copia).
        const repetida = chaves.has(nota.chaveAcesso);
        chaves.add(nota.chaveAcesso);

        console.log(`--- ${nome} ---`);
        console.log(`  fornecedor : ${nota.nomeEmitente}`);
        console.log(`  CNPJ       : ${nota.cnpjEmitente}`);
        console.log(`  emitida p/ : ${nota.nomeDestinatario}`);
        console.log(`  documento  : ${nota.documentoDestinatario}`);
        console.log(`  nota       : ${nota.numero}/${nota.serie}  de ${nota.dataEmissao.toLocaleDateString("pt-BR")}`);
        console.log(`  total      : R$ ${nota.valorTotal.toFixed(2)}   confere: ${t.confere ? "sim" : "NAO (R$ " + t.diferenca.toFixed(2) + ")"}`);
        if (repetida) console.log("  ATENCAO: esta chave ja apareceu antes nesta caixa");
        console.log(`  itens      : ${nota.itens.length}`);
        for (const i of nota.itens) {
          console.log(
            `    [${i.numero}] ${i.codigo.padEnd(10)} ${i.descricao.slice(0, 42).padEnd(42)}` +
              ` ${String(i.quantidade).padStart(6)} ${i.unidade.padEnd(3)}` +
              ` R$ ${i.custoUnitarioReal.toFixed(2).padStart(9)}/un`,
          );
        }
        console.log("");
      } catch (e) {
        recusadas++;
        console.log(`--- ${nome} ---`);
        console.log(`  RECUSADO: ${e instanceof XmlInvalidoError ? e.message : String(e)}`);
        console.log("");
      }
    }
  }
}

await cliente.logout();
console.log("=== resumo ===");
console.log(`  notas lidas    : ${lidas}`);
console.log(`  arquivos recusados: ${recusadas}`);
console.log(`  chaves distintas  : ${chaves.size}`);
process.exit(lidas > 0 ? 0 : 1);
