import { env } from "../env.js";
import { AppError } from "../lib/errors.js";

/**
 * Leitura de texto de PDF via OCR.space.
 *
 * SO ORIENTA, NAO PREENCHE NUMERO SOZINHO. O laudo em PDF ja tinha esse
 * problema antes do OCR existir aqui: o mesmo pH que sai "5,7" no papel vira
 * "5.650000095367432" na planilha, e o texto corrido de um PDF junta valores
 * vizinhos ("23,7512,21" são dois números) e quebra número entre linhas de
 * jeito imprevisível conforme o layout do laboratório. Setes laboratorios
 * diferentes, sete layouts diferentes - tentar reconstruir a tabela sozinho
 * a partir de texto OCR arriscaria gravar 23,75 onde era 2.375, e isso vira
 * adubação errada. O texto extraído aqui é só para o usuário CONFERIR mais
 * rápido, sem precisar abrir o PDF numa janela ao lado - a digitação e a
 * decisão continuam sendo dele.
 *
 * A chave NUNCA sai do servidor - o navegador manda os bytes do PDF para a
 * nossa API, que fala com a OCR.space e devolve so o texto, nunca o arquivo.
 */

const URL_OCR = "https://api.ocr.space/parse/image";

export function ocrConfigurado(): boolean {
  return !!env.OCR_SPACE_API_KEY;
}

interface RespostaOcrSpace {
  OCRExitCode: number;
  IsErroredOnProcessing: boolean;
  ErrorMessage?: string | string[];
  ParsedResults?: { ParsedText: string }[];
}

/**
 * @param pdfBase64 Data URL completa ("data:application/pdf;base64,...")
 *   ou so o base64 puro - os dois formatos funcionam na OCR.space.
 */
export async function extrairTextoDoPdf(pdfBase64: string): Promise<string> {
  if (!ocrConfigurado()) {
    throw new AppError("Leitura de PDF por OCR não configurada no servidor.", 503);
  }

  const corpo = new URLSearchParams();
  corpo.set("apikey", env.OCR_SPACE_API_KEY!);
  corpo.set("base64Image", pdfBase64.startsWith("data:") ? pdfBase64 : `data:application/pdf;base64,${pdfBase64}`);
  corpo.set("filetype", "PDF");
  // Preserva a disposição em colunas do laudo - texto corrido perderia a
  // relação entre o nome do nutriente e o número dele.
  corpo.set("isTable", "true");
  // Motor 2 le PDF e tem OCR melhor para tabela numerica que o motor 1.
  corpo.set("OCREngine", "2");
  corpo.set("scale", "true");

  let resposta: Response;
  try {
    resposta = await fetch(URL_OCR, {
      method: "POST",
      body: corpo,
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err) {
    throw new AppError(
      `Não foi possível falar com o serviço de OCR agora (${err instanceof Error ? err.message : "erro desconhecido"}).`,
      503,
    );
  }

  if (!resposta.ok) {
    throw new AppError(`OCR.space respondeu HTTP ${resposta.status}.`, 502);
  }

  const dados = (await resposta.json()) as RespostaOcrSpace;
  if (dados.IsErroredOnProcessing) {
    const msg = Array.isArray(dados.ErrorMessage) ? dados.ErrorMessage.join(" ") : dados.ErrorMessage;
    throw new AppError(`OCR não conseguiu ler o PDF: ${msg ?? "motivo não informado"}.`, 422);
  }

  const paginas = dados.ParsedResults ?? [];
  if (paginas.length === 0 || !paginas.some((p) => p.ParsedText?.trim())) {
    throw new AppError("O OCR não encontrou texto neste PDF — pode ser uma imagem escaneada de baixa qualidade.", 422);
  }

  return paginas.map((p) => p.ParsedText).join("\n\n--- página seguinte ---\n\n").trim();
}
