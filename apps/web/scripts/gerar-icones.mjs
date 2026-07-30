// Gera os icones do PWA (192 e 512 px) sem depender de biblioteca externa:
// desenha os pixels na mao e monta o PNG com zlib, que e nativo do Node.
// Rodar: node scripts/gerar-icones.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DESTINO = join(AQUI, "..", "public", "icons");

// paleta alinhada ao tema do sistema
const VERDE_FUNDO = [21, 101, 52]; // #156534
const VERDE_CLARO = [34, 139, 70];
const AMARELO = [232, 200, 62]; // limão
const FOLHA = [126, 200, 110];

const crcTabela = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTabela[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipo, dados) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, crc]);
}

function montarPng(largura, altura, rgba) {
  const assinatura = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  // 10,11,12 = compressao/filtro/interlace padrao (0)

  // cada linha comeca com o byte de filtro (0 = sem filtro)
  const bruto = Buffer.alloc(altura * (1 + largura * 4));
  for (let y = 0; y < altura; y++) {
    const inicio = y * (1 + largura * 4);
    bruto[inicio] = 0;
    rgba.copy(bruto, inicio + 1, y * largura * 4, (y + 1) * largura * 4);
  }

  return Buffer.concat([
    assinatura,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(bruto, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// mistura duas cores conforme a cobertura (0..1) - antialiasing simples
const misturar = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function desenhar(tamanho) {
  const px = Buffer.alloc(tamanho * tamanho * 4);
  const c = tamanho / 2;
  const raioFundo = tamanho * 0.5;
  const raioLimao = tamanho * 0.26;
  const suavizar = tamanho * 0.012;

  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      const i = (y * tamanho + x) * 4;
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const dist = Math.hypot(dx, dy);

      // fundo circular com leve degradê para dar profundidade
      const dentroFundo = 1 - Math.min(1, Math.max(0, (dist - (raioFundo - suavizar)) / suavizar));
      if (dentroFundo <= 0) {
        px[i + 3] = 0; // transparente fora do circulo
        continue;
      }
      const degrade = Math.min(1, Math.max(0, (y / tamanho) * 0.6));
      let cor = misturar(VERDE_CLARO, VERDE_FUNDO, degrade);

      // fruto no centro
      const dentroLimao = 1 - Math.min(1, Math.max(0, (dist - (raioLimao - suavizar)) / suavizar));
      if (dentroLimao > 0) cor = misturar(cor, AMARELO, dentroLimao);

      // folha saindo do topo direito do fruto
      const fx = (dx - tamanho * 0.12) / (tamanho * 0.15);
      const fy = (dy + tamanho * 0.26) / (tamanho * 0.075);
      const anguloFolha = Math.PI / 5;
      const rx = fx * Math.cos(anguloFolha) - fy * Math.sin(anguloFolha);
      const ry = fx * Math.sin(anguloFolha) + fy * Math.cos(anguloFolha);
      const naFolha = rx * rx + ry * ry <= 1 ? 1 : 0;
      if (naFolha) cor = FOLHA;

      px[i] = cor[0];
      px[i + 1] = cor[1];
      px[i + 2] = cor[2];
      px[i + 3] = Math.round(255 * dentroFundo);
    }
  }
  return px;
}

mkdirSync(DESTINO, { recursive: true });
for (const tamanho of [192, 512]) {
  const png = montarPng(tamanho, tamanho, desenhar(tamanho));
  const caminho = join(DESTINO, `icon-${tamanho}.png`);
  writeFileSync(caminho, png);
  console.log(`gerado ${caminho} (${tamanho}x${tamanho}, ${png.length} bytes)`);
}
