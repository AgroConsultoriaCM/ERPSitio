// Rotas do painel num lugar so - evita string solta espalhada pelas telas e
// deixa uma futura reorganizacao de menu barata.
export const ROTAS = {
  dashboard: "/painel",
  mapa: "/painel/mapa",
  colheitas: "/painel/colheitas",
  operacoes: "/painel/atividades",
  pulverizacoes: "/painel/pulverizacoes",
  pragas: "/painel/pragas",
  irrigacao: "/painel/irrigacao",
  manejoNutricional: "/painel/manejo-nutricional",
  manejoNutricionalTalhao: (id: string) => `/painel/manejo-nutricional/${id}`,
  estoque: "/painel/estoque",
  notas: "/painel/notas",
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
  adicionarAnalise: "/painel/cadastros/adicionar-analise",
  tiposOperacao: "/painel/cadastros/tipos-operacao",
  parametrosPulverizacao: "/painel/cadastros/parametros-pulverizacao",
  perfisBomba: "/painel/cadastros/perfis-bomba",
  caldas: "/painel/cadastros/caldas",
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
  { rota: ROTAS.insumos, rotula: "Produtos", descricao: "Preço médio, dose de bula e funções" },
  {
    rota: ROTAS.tiposOperacao,
    rotula: "Cadastrar operações",
    descricao: "Tipos de manejo para escolher ao lançar uma operação",
  },
  {
    rota: ROTAS.perfisCorrecao,
    rotula: "Perfis de correção",
    descricao: "Faixas ideais de solo por cultura",
  },
  {
    rota: ROTAS.adicionarAnalise,
    rotula: "Adicionar análise",
    descricao: "Importar laudos de solo, folha e composto",
  },
  {
    rota: ROTAS.parametrosPulverizacao,
    rotula: "Janela de pulverização",
    descricao: "Parâmetros ideais de chuva, vento e umidade",
  },
  {
    rota: ROTAS.perfisBomba,
    rotula: "Bombas de pulverização",
    descricao: "Capacidade em litros de cada bomba",
  },
  {
    rota: ROTAS.caldas,
    rotula: "Caldas",
    descricao: "Receitas de calda para pulverização",
  },
];
