import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { PrismaClient } from "@erpsitio/db";
import { env } from "../env.js";
import { receberNotaXml, XmlInvalidoError } from "./notasEntrada.js";

export function emailNotasConfigurado(): boolean {
  return !!env.EMAIL_NOTAS_USUARIO && !!env.EMAIL_NOTAS_SENHA;
}

export interface ResumoSincronizacao {
  novas: number;
  repetidas: number;
  recusadas: string[];
}

/**
 * Varre os ultimos e-mails da caixa em busca de anexo .xml e guarda cada um
 * como nota PENDENTE (via receberNotaXml - mesma regra da tela, nao mexe em
 * estoque). So le (readOnly): nada e apagado ou marcado como lido na caixa.
 *
 * Sempre olha as ultimas 50 mensagens, em vez de guardar "ultima lida" - nota
 * repetida nao e problema porque o dedupe e por chaveAcesso no banco (ver
 * notasEntrada.ts), e isso evita perder nota se o servidor ficar fora do ar
 * por um tempo maior que o intervalo do agendamento.
 */
export async function sincronizarCaixaDeNotas(
  prisma: PrismaClient,
  propriedadeId: string,
): Promise<ResumoSincronizacao> {
  if (!emailNotasConfigurado()) {
    throw new Error("EMAIL_NOTAS_USUARIO/EMAIL_NOTAS_SENHA não configurados");
  }

  const cliente = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: env.EMAIL_NOTAS_USUARIO!, pass: env.EMAIL_NOTAS_SENHA! },
    logger: false,
  });

  const resumo: ResumoSincronizacao = { novas: 0, repetidas: 0, recusadas: [] };

  await cliente.connect();
  try {
    const caixa = await cliente.mailboxOpen("INBOX", { readOnly: true });
    if (caixa.exists === 0) return resumo;

    const inicio = Math.max(1, caixa.exists - 49);
    for await (const msg of cliente.fetch(`${inicio}:*`, { source: true })) {
      const email = await simpleParser(msg.source as Buffer);
      for (const anexo of email.attachments ?? []) {
        const nome = anexo.filename ?? "";
        if (!nome.toLowerCase().endsWith(".xml")) continue;

        try {
          const resultado = await receberNotaXml(
            prisma,
            propriedadeId,
            anexo.content.toString("utf8"),
            nome,
          );
          if (resultado.jaExistia) resumo.repetidas++;
          else resumo.novas++;
        } catch (erro) {
          const motivo = erro instanceof XmlInvalidoError ? erro.message : String(erro);
          resumo.recusadas.push(`${nome}: ${motivo}`);
        }
      }
    }
  } finally {
    await cliente.logout();
  }

  return resumo;
}
