// Rotas do painel num lugar so - evita string solta espalhada pelas telas e
// deixa uma futura reorganizacao de menu barata.
export const ROTAS = {
  dashboard: "/painel",
  mapa: "/painel/mapa",
  colheitas: "/painel/colheitas",
  operacoes: "/painel/atividades",
  pragas: "/painel/pragas",
  irrigacao: "/painel/irrigacao",
  estoque: "/painel/estoque",
  usuarios: "/painel/usuarios",

  // Cadastros ficam agrupados em sub-abas
  cadastros: "/painel/cadastros",
  propriedade: "/painel/cadastros/propriedade",
  talhoes: "/painel/cadastros/talhoes",
  talhaoNovo: "/painel/cadastros/talhoes/novo",
  talhao: (id: string) => `/painel/cadastros/talhoes/${id}`,
  setores: "/painel/cadastros/setores",
  setorNovo: "/painel/cadastros/setores/novo",
  setor: (id: string) => `/painel/cadastros/setores/${id}`,
  grupos: "/painel/cadastros/grupos",
  culturas: "/painel/cadastros/culturas",
  executores: "/painel/cadastros/executores",
  insumos: "/painel/cadastros/insumos",
  perfisCorrecao: "/painel/cadastros/perfis-correcao",
} as const;

export interface AbaCadastro {
  rota: string;
  rotula: string;
  descricao: string;
}

export const ABAS_CADASTRO: AbaCadastro[] = [
  { rota: ROTAS.propriedade, rotula: "Propriedade", descricao: "Dados e contorno do sítio" },
  { rota: ROTAS.talhoes, rotula: "Talhões", descricao: "Áreas produtivas" },
  { rota: ROTAS.setores, rotula: "Setores de irrigação", descricao: "Setores do manejo hídrico" },
  { rota: ROTAS.grupos, rotula: "Grupos de talhões", descricao: "Atalhos para lançar operações" },
  { rota: ROTAS.culturas, rotula: "Culturas", descricao: "Espécies e variedades" },
  { rota: ROTAS.executores, rotula: "Executores", descricao: "Equipe, empreiteiros e prestadores" },
  { rota: ROTAS.insumos, rotula: "Insumos", descricao: "Produtos e sua função agronômica" },
  {
    rota: ROTAS.perfisCorrecao,
    rotula: "Perfis de correção",
    descricao: "Faixas ideais de solo por cultura",
  },
];
