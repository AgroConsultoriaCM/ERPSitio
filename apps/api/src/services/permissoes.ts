import type { PrismaClient, RolePapel } from "@erpsitio/db";

// Modulos do sistema. Cada um corresponde a uma area da interface e agrupa as
// rotas relacionadas - granularidade escolhida para a matriz caber numa tela.
export const MODULOS = [
  { id: "dashboard", rotulo: "Dashboard", descricao: "Visão geral e indicadores" },
  { id: "mapa", rotulo: "Mapa da propriedade", descricao: "Mapa com talhões e setores" },
  { id: "colheitas", rotulo: "Colheitas", descricao: "Lançamento e consolidação de colheita" },
  { id: "operacoes", rotulo: "Operações", descricao: "Poda, pulverização, fertirrigação etc." },
  { id: "estoque", rotulo: "Estoque", descricao: "Compras, lotes e movimentações" },
  { id: "notas", rotulo: "Notas fiscais de entrada", descricao: "Notas recebidas, à espera de decisão" },
  { id: "pragas", rotulo: "Controle de pragas", descricao: "Alertas e histórico de aplicações" },
  { id: "irrigacao", rotulo: "Manejo hídrico", descricao: "Irrigação e clima" },
  { id: "analises", rotulo: "Análises de solo/folha", descricao: "Laudos e diagnóstico" },
  { id: "cadastros", rotulo: "Cadastros", descricao: "Talhões, culturas, insumos, executores..." },
  { id: "propriedade", rotulo: "Propriedade", descricao: "Dados e contorno do sítio" },
  { id: "usuarios", rotulo: "Usuários e permissões", descricao: "Acesso ao sistema" },
] as const;

export type ModuloId = (typeof MODULOS)[number]["id"];
export type AcaoPermissao = "VER" | "EDITAR";

export interface Permissao {
  modulo: string;
  podeVer: boolean;
  podeEditar: boolean;
}

// Padrao aplicado quando ainda nao ha nada configurado - reproduz o
// comportamento que o sistema tinha antes das permissoes existirem.
const PADRAO: Record<RolePapel, Record<string, [ver: boolean, editar: boolean]>> = {
  ADMIN: Object.fromEntries(MODULOS.map((m) => [m.id, [true, true]])),
  GERENTE: {
    ...Object.fromEntries(MODULOS.map((m) => [m.id, [true, true]])),
    usuarios: [false, false],
  },
  ENCARREGADO: {
    dashboard: [false, false],
    mapa: [true, false],
    colheitas: [true, true],
    operacoes: [true, true],
    estoque: [true, false],
    // Nota fiscal e assunto do escritorio: envolve fornecedor, preco e
    // decisao de compra. O encarregado nunca precisa ver.
    notas: [false, false],
    pragas: [false, false],
    irrigacao: [true, true],
    analises: [false, false],
    // precisa enxergar talhoes/insumos/executores para conseguir lancar
    cadastros: [true, false],
    propriedade: [false, false],
    usuarios: [false, false],
  },
};

export function permissoesPadrao(papel: RolePapel): Permissao[] {
  return MODULOS.map((m) => {
    const [podeVer, podeEditar] = PADRAO[papel][m.id] ?? [false, false];
    return { modulo: m.id, podeVer, podeEditar };
  });
}

// Cache por propriedade: a matriz muda raramente e e consultada em toda
// requisicao autenticada.
const cache = new Map<string, Map<RolePapel, Permissao[]>>();

export function limparCachePermissoes(propriedadeId?: string) {
  if (propriedadeId) cache.delete(propriedadeId);
  else cache.clear();
}

export async function permissoesDoPapel(
  prisma: PrismaClient,
  propriedadeId: string,
  papel: RolePapel,
): Promise<Permissao[]> {
  // ADMIN e sempre total: sem isso, uma configuracao errada poderia deixar a
  // propriedade sem ninguem capaz de corrigi-la.
  if (papel === "ADMIN") return permissoesPadrao("ADMIN");

  const daPropriedade = cache.get(propriedadeId);
  const emCache = daPropriedade?.get(papel);
  if (emCache) return emCache;

  const gravadas = await prisma.permissaoPapel.findMany({
    where: { propriedadeId, papel },
  });

  const porModulo = new Map(gravadas.map((p) => [p.modulo, p]));
  const resultado = permissoesPadrao(papel).map((padrao) => {
    const gravada = porModulo.get(padrao.modulo);
    return gravada
      ? { modulo: padrao.modulo, podeVer: gravada.podeVer, podeEditar: gravada.podeEditar }
      : padrao;
  });

  const mapaPapel = daPropriedade ?? new Map<RolePapel, Permissao[]>();
  mapaPapel.set(papel, resultado);
  cache.set(propriedadeId, mapaPapel);
  return resultado;
}

export async function temPermissao(
  prisma: PrismaClient,
  propriedadeId: string,
  papel: RolePapel,
  modulo: ModuloId,
  acao: AcaoPermissao,
): Promise<boolean> {
  const lista = await permissoesDoPapel(prisma, propriedadeId, papel);
  const p = lista.find((x) => x.modulo === modulo);
  if (!p) return false;
  // editar implica poder ver
  return acao === "EDITAR" ? p.podeEditar : p.podeVer || p.podeEditar;
}
