// Leitura do XML da NF-e.
//
// O fornecedor manda dois arquivos: o XML e o DANFE em PDF. O XML e o
// documento de verdade - estruturado, exato e assinado. E dele que tiramos os
// itens que entram no estoque.
//
// Por que nao o PDF: precisaria de OCR, e OCR erra virgula. Aqui isso seria
// entrar 1.000 litros onde eram 100, ou R$ 45,00 onde era R$ 450,00 - numeros
// que vao direto para o custo por talhao e para a margem da colheita.

import { XMLParser } from "fast-xml-parser";

export interface ItemNota {
  /** Numero do item dentro da nota (1, 2, 3...). */
  numero: number;
  /** Codigo do produto no catalogo do FORNECEDOR - a chave do reconhecimento. */
  codigo: string;
  descricao: string;
  ncm: string | null;
  /** Texto livre do item na nota (`infAdProd`). */
  infoAdicional: string | null;
  /**
   * Numero de registro do produto no MAPA, quando a nota informa.
   *
   * E a unica chave *exata* entre a nota e o cadastro oficial (Agrofit).
   * Casar por nome comercial erra: a nota escreve "ZAPP QI 620" e o cadastro
   * "Zapp QI", com acento, espaco e maiuscula diferentes.
   */
  registroMapa: string | null;
  unidade: string;
  quantidade: number;
  /** Preco unitario como veio na nota, sem rateio de despesas. */
  valorUnitario: number;
  valorProduto: number;
  desconto: number;
  frete: number;
  seguro: number;
  outrasDespesas: number;
  /**
   * O que o produto custou de fato, por unidade: preco menos desconto, mais
   * frete, seguro e demais despesas rateadas pelo proprio item.
   *
   * E este o numero que deve alimentar o estoque. Usar o preco "de tabela"
   * subestima o custo de cada pulverizacao.
   */
  custoUnitarioReal: number;
}

export interface NotaLida {
  chaveAcesso: string;
  numero: string;
  serie: string;
  dataEmissao: Date;
  cnpjEmitente: string;
  nomeEmitente: string;
  /**
   * Para quem a nota foi emitida.
   *
   * Importa porque a mesma caixa de e-mail recebe notas de mais de uma pessoa
   * juridica da familia. A tela precisa distinguir o que e da propriedade do
   * que so passou por ali - importar nota alheia significa estoque e custo
   * errados, em silencio.
   */
  documentoDestinatario: string;
  nomeDestinatario: string;
  valorTotal: number;
  itens: ItemNota[];
}

export class XmlInvalidoError extends Error {}

/**
 * O parser devolve objeto quando a tag aparece uma vez e lista quando aparece
 * varias. Nota com um item unico e o caso mais comum numa propriedade pequena,
 * entao tratar isso e obrigatorio, nao detalhe.
 */
function comoLista<T>(valor: T | T[] | undefined | null): T[] {
  if (valor === undefined || valor === null) return [];
  return Array.isArray(valor) ? valor : [valor];
}

/** Numero do XML vem como string ("450.0000000000") ou ja convertido. */
function numero(valor: unknown, padrao = 0): number {
  if (valor === undefined || valor === null || valor === "") return padrao;
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : padrao;
}

function texto(valor: unknown): string {
  if (valor === undefined || valor === null) return "";
  return String(valor).trim();
}

/** Arredonda para centavos, evitando 0.30000000000000004 no custo. */
function centavos(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Numero de registro do produto no MAPA, tirado do texto livre da nota.
 *
 * Por que isto importa: e a unica chave EXATA entre a nota fiscal e o cadastro
 * oficial do Agrofit. Casar por nome comercial nao fecha - a nota escreve
 * "ZAPP QI 620" e o cadastro tem "Zapp QI", com acento, espaco e caixa
 * diferentes, e ha marcas homonimas de titulares distintos.
 *
 * O layout da NF-e nao tem campo proprio para agrotoxico (tem para veiculo,
 * medicamento, arma e combustivel, mas nao para defensivo). Entao o registro
 * vem no `infAdProd`, em texto livre, escrito de um jeito diferente por
 * emitente.
 *
 * REGRA DE OURO, herdada do `embalagem.ts`: **so extrai quando o numero esta
 * ancorado numa mencao explicita ao MAPA ou ao Ministerio da Agricultura.**
 * Numero solto vira chute, e em "ZAPP QI 620" o 620 e concentracao, nao
 * registro - trocar um pelo outro cadastraria o produto errado, com o modo de
 * acao errado, no controle de pragas.
 */
export function extrairRegistroMapa(
  infoAdicional: string | null,
  descricao = "",
): string | null {
  const fonte = `${infoAdicional ?? ""} ${descricao}`;
  if (!fonte.trim()) return null;

  // Normaliza acento e espacos para a busca ficar previsivel.
  const limpo = fonte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");

  // "MAPA", "M.A.P.A." ou "Ministerio da Agricultura", seguido de rotulos
  // opcionais (registro, sob, numero, n, no, nº) e entao os digitos.
  const ancoras = [
    /(?:REG(?:ISTRO)?\.?\s*(?:NO|N[°ºo]?)?\s*)?M\.?A\.?P\.?A\.?\s*(?:SOB)?\s*(?:N[°ºo]?|NUM(?:ERO)?)?\s*[:\-]?\s*(\d{3,7})/i,
    /MINISTERIO\s+DA\s+AGRICULTURA[^0-9]{0,40}?(\d{3,7})/i,
    /REG(?:ISTRO)?\.?\s*(?:N[°ºo]?)?\s*[:\-]?\s*(\d{3,7})\s*[-–]?\s*MAPA/i,
  ];

  for (const padrao of ancoras) {
    const achado = limpo.match(padrao);
    if (achado?.[1]) {
      // O Agrofit devolve sem zeros a esquerda ("7208", nao "07208").
      const semZeros = achado[1].replace(/^0+/, "");
      if (semZeros.length >= 3) return semZeros;
    }
  }

  return null;
}

export function lerXmlNfe(xml: string): NotaLida {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    // Sem isto o parser converte a chave de acesso (44 digitos) em numero e
    // perde precisao, e transforma codigo de produto "007" em 7.
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
  });

  let raiz: Record<string, unknown>;
  try {
    raiz = parser.parse(xml) as Record<string, unknown>;
  } catch {
    throw new XmlInvalidoError("Não consegui ler o arquivo: ele não é um XML válido.");
  }

  // A nota pode vir embrulhada no protocolo de autorizacao (nfeProc) ou solta.
  const proc = raiz.nfeProc as Record<string, unknown> | undefined;
  const nfe = (proc?.NFe ?? raiz.NFe) as Record<string, unknown> | undefined;
  const inf = nfe?.infNFe as Record<string, unknown> | undefined;

  if (!inf) {
    throw new XmlInvalidoError(
      "Este XML não parece ser uma NF-e. Confira se não enviou o arquivo errado " +
        "(o do evento de cancelamento ou o recibo, por exemplo).",
    );
  }

  // Id vem como "NFe35240612345678000199550010000012341234567890"
  const chaveAcesso = texto(inf["@Id"]).replace(/^NFe/i, "");
  if (!/^\d{44}$/.test(chaveAcesso)) {
    throw new XmlInvalidoError("A chave de acesso da nota está ausente ou fora do padrão.");
  }

  const ide = (inf.ide ?? {}) as Record<string, unknown>;
  const emit = (inf.emit ?? {}) as Record<string, unknown>;
  const dest = (inf.dest ?? {}) as Record<string, unknown>;
  const total = ((inf.total as Record<string, unknown>)?.ICMSTot ?? {}) as Record<string, unknown>;

  const dataBruta = texto(ide.dhEmi) || texto(ide.dEmi);
  const dataEmissao = new Date(dataBruta);
  if (Number.isNaN(dataEmissao.getTime())) {
    throw new XmlInvalidoError("A data de emissão da nota está ausente ou ilegível.");
  }

  const itens: ItemNota[] = comoLista(inf.det as unknown).map((det, indice) => {
    const d = det as Record<string, unknown>;
    const prod = (d.prod ?? {}) as Record<string, unknown>;
    // Texto livre do item. E onde o registro do MAPA aparece nas notas de
    // defensivo: o layout da NF-e nao tem campo proprio para agrotoxico.
    const infoAdicional = texto(d.infAdProd) || null;

    const quantidade = numero(prod.qCom);
    const valorProduto = numero(prod.vProd);
    const desconto = numero(prod.vDesc);
    const frete = numero(prod.vFrete);
    const seguro = numero(prod.vSeg);
    const outrasDespesas = numero(prod.vOutro);

    const custoTotalItem = valorProduto - desconto + frete + seguro + outrasDespesas;

    return {
      numero: Number(texto(d["@nItem"])) || indice + 1,
      codigo: texto(prod.cProd),
      descricao: texto(prod.xProd),
      ncm: texto(prod.NCM) || null,
      unidade: texto(prod.uCom).toUpperCase(),
      quantidade,
      valorUnitario: numero(prod.vUnCom),
      valorProduto,
      desconto,
      frete,
      seguro,
      outrasDespesas,
      // Quantidade zero existe em nota de brinde/bonificacao. Dividir ali
      // geraria Infinity e contaminaria o custo do estoque em silencio.
      custoUnitarioReal: quantidade > 0 ? centavos(custoTotalItem / quantidade) : 0,
      infoAdicional,
      registroMapa: extrairRegistroMapa(infoAdicional, texto(prod.xProd)),
    };
  });

  if (itens.length === 0) {
    throw new XmlInvalidoError("A nota não tem nenhum item.");
  }

  return {
    chaveAcesso,
    numero: texto(ide.nNF),
    serie: texto(ide.serie),
    dataEmissao,
    cnpjEmitente: texto(emit.CNPJ) || texto(emit.CPF),
    nomeEmitente: texto(emit.xNome),
    // Produtor rural pode receber como pessoa fisica: aceita CPF tambem.
    documentoDestinatario: texto(dest.CNPJ) || texto(dest.CPF),
    nomeDestinatario: texto(dest.xNome),
    valorTotal: numero(total.vNF),
    itens,
  };
}

/**
 * Confere se a soma dos itens bate com o total declarado na nota.
 *
 * Serve de rede: se divergir, alguma coisa foi lida errado e e melhor avisar
 * antes de mexer no estoque do que descobrir depois no custo do talhao.
 */
export function conferirTotal(nota: NotaLida): { confere: boolean; somaItens: number; diferenca: number } {
  const somaItens = centavos(
    nota.itens.reduce(
      (s, i) => s + i.valorProduto - i.desconto + i.frete + i.seguro + i.outrasDespesas,
      0,
    ),
  );
  const diferenca = centavos(Math.abs(somaItens - nota.valorTotal));
  // Um centavo de folga: a NF-e arredonda cada item, e a soma pode nao fechar
  // exatamente com o total.
  return { confere: diferenca <= 0.01, somaItens, diferenca };
}
