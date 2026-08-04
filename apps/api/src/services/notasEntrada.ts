import type { PrismaClient } from "@erpsitio/db";
import { lerXmlNfe, XmlInvalidoError } from "./nfe.js";

export interface ResultadoRecebimento {
  jaExistia: boolean;
  nota: { id: string; numero: string; serie: string; nomeEmitente: string; nomeDestinatario: string | null; valorTotal: number };
}

/**
 * Guarda um XML de NF-e como nota PENDENTE (nao mexe em estoque). Nota
 * repetida nao e erro - devolve a que ja existe, porque reenvio de e-mail e
 * comum. Extraida da rota POST /notas para tambem servir a leitura
 * automatica da caixa de e-mail (services/emailNotas.ts), que roda sem
 * requisicao HTTP nenhuma.
 */
export async function receberNotaXml(
  prisma: PrismaClient,
  propriedadeId: string,
  xml: string,
  nomeArquivo?: string,
): Promise<ResultadoRecebimento> {
  const nota = lerXmlNfe(xml);

  const existente = await prisma.notaFiscalEntrada.findUnique({
    where: { chaveAcesso: nota.chaveAcesso },
  });
  if (existente) {
    return { jaExistia: true, nota: existente };
  }

  const criada = await prisma.notaFiscalEntrada.create({
    data: {
      chaveAcesso: nota.chaveAcesso,
      numero: nota.numero,
      serie: nota.serie,
      dataEmissao: nota.dataEmissao,
      cnpjEmitente: nota.cnpjEmitente,
      nomeEmitente: nota.nomeEmitente,
      documentoDestinatario: nota.documentoDestinatario || null,
      nomeDestinatario: nota.nomeDestinatario || null,
      valorTotal: nota.valorTotal,
      xmlOriginal: xml,
      observacoes: nomeArquivo ?? null,
      propriedadeId,
    },
  });

  return { jaExistia: false, nota: criada };
}

export { XmlInvalidoError };
