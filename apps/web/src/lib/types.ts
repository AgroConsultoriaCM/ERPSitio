export interface PoligonoGeoJSON {
  type: "Polygon";
  coordinates: number[][][];
}

export interface Propriedade {
  id: string;
  nome: string;
  localizacao?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  poligono?: PoligonoGeoJSON | null;
}

export interface Cultura {
  id: string;
  nome: string;
  variedade?: string | null;
}

export interface Talhao {
  id: string;
  nome: string;
  codigo?: string | null;
  areaHa?: number | null;
  culturaId?: string | null;
  cultura?: Cultura | null;
  dataPlantio?: string | null;
  espacamentoEntrePlantas?: number | null;
  espacamentoEntreLinhas?: number | null;
  status: "EM_FORMACAO" | "ATIVO" | "INATIVO";
  poligono?: PoligonoGeoJSON | null;
  corMapa?: string | null;
}

export interface SetorIrrigacao {
  id: string;
  nome: string;
  codigo?: string | null;
  areaHa?: number | null;
  poligono?: PoligonoGeoJSON | null;
  corMapa?: string | null;
  observacoes?: string | null;
}

export interface Safra {
  id: string;
  nome: string;
  talhaoId: string;
  dataInicio: string;
  dataFim?: string | null;
  observacoes?: string | null;
}

export interface TipoAtividade {
  id: string;
  nome: string;
  descricao?: string | null;
}

export type FuncaoInsumo =
  | "INSETICIDA"
  | "FUNGICIDA"
  | "HERBICIDA"
  | "ACARICIDA"
  | "NEMATICIDA"
  | "NUTRICAO_FOLIAR"
  | "FERTILIZANTE_SOLO"
  | "ADJUVANTE"
  | "OUTRO";

export const ROTULO_FUNCAO_INSUMO: Record<FuncaoInsumo, string> = {
  INSETICIDA: "Inseticida",
  FUNGICIDA: "Fungicida",
  HERBICIDA: "Herbicida",
  ACARICIDA: "Acaricida",
  NEMATICIDA: "Nematicida",
  NUTRICAO_FOLIAR: "Nutrição foliar",
  FERTILIZANTE_SOLO: "Fertilizante de solo",
  ADJUVANTE: "Adjuvante",
  OUTRO: "Outro",
};

export interface Insumo {
  id: string;
  nome: string;
  categoria: "DEFENSIVO" | "FERTILIZANTE" | "EMBALAGEM" | "OUTRO";
  funcao?: FuncaoInsumo | null;
  unidadeMedida: string;
  estoqueMinimo?: number | null;
  saldoAtual?: number;
}

export type TipoExecutor = "EQUIPE_PROPRIA" | "EMPREITEIRO" | "PRESTADOR_SERVICO";

export const ROTULO_TIPO_EXECUTOR: Record<TipoExecutor, string> = {
  EQUIPE_PROPRIA: "Equipe própria",
  EMPREITEIRO: "Empreiteiro",
  PRESTADOR_SERVICO: "Prestador de serviço",
};

export interface Executor {
  id: string;
  nome: string;
  tipo: TipoExecutor;
  contato?: string | null;
  observacoes?: string | null;
  ativo: boolean;
}

export interface GrupoTalhaoResumo {
  id: string;
  nome: string;
  corMapa?: string | null;
  observacoes?: string | null;
  talhoes: { id: string; nome: string; codigo?: string | null; areaHa?: number | null }[];
  areaTotalHa: number;
}

export interface AtividadeInsumo {
  id: string;
  insumoId: string;
  insumo: Insumo;
  quantidade: number;
  quantidadeLevada?: number | null;
  quantidadeRetornada?: number | null;
  unidade: string;
  custoUnitario?: number | null;
  custoTotal?: number | null;
}

export type OrigemLote = "COMPRA" | "INVENTARIO_INICIAL" | "AJUSTE";

export interface LoteInsumo {
  id: string;
  insumoId: string;
  insumo?: { id: string; nome: string; unidadeMedida: string };
  origem: OrigemLote;
  data: string;
  quantidade: number;
  quantidadeRestante: number;
  precoUnitario: number;
  fornecedor?: string | null;
  numeroNota?: string | null;
  observacoes?: string | null;
}

export type EscopoAlerta = "TODOS_TALHOES" | "GRUPO" | "TALHAO";

export interface RegraAlerta {
  id: string;
  nome: string;
  funcao: FuncaoInsumo;
  intervaloDias: number;
  escopo: EscopoAlerta;
  grupoId?: string | null;
  talhaoId?: string | null;
  ativo: boolean;
  observacoes?: string | null;
}

export interface AlertaPraga {
  regraId: string;
  regraNome: string;
  funcao: FuncaoInsumo;
  intervaloDias: number;
  talhaoId: string;
  talhaoNome: string;
  talhaoCodigo?: string | null;
  ultimaAplicacao: string | null;
  diasDesdeUltima: number | null;
  diasVencido: number | null;
  nuncaAplicado: boolean;
}

export interface UltimaAplicacaoTalhao {
  talhaoId: string;
  nome: string;
  codigo?: string | null;
  aplicacoes: Record<string, { data: string; diasAtras: number; produto: string }>;
}

export interface Irrigacao {
  id: string;
  setorId: string;
  setor?: { id: string; nome: string; codigo?: string | null; areaHa?: number | null };
  data: string;
  duracaoHoras?: number | null;
  laminaMm?: number | null;
  observacoes?: string | null;
  responsavel?: { id: string; nome: string } | null;
}

export interface SituacaoSetor {
  setorId: string;
  nome: string;
  codigo?: string | null;
  areaHa?: number | null;
  ultimaIrrigacao: string | null;
  diasDesdeUltima: number | null;
  duracaoHoras?: number | null;
  laminaMm?: number | null;
}

export interface DiaClima {
  data: string;
  chuvaMm: number | null;
  tempMax: number | null;
  tempMin: number | null;
  probabilidadeChuva: number | null;
  evapotranspiracaoMm: number | null;
  passado: boolean;
}

export interface RespostaClima {
  latitude: number;
  longitude: number;
  atualizadoEm: string;
  dias: DiaClima[];
  chuva7DiasMm: number;
  chuva30DiasMm: number;
  chuvaPrevista7DiasMm: number;
  diasSemChuva: number | null;
}

export interface AtividadeTalhao {
  id: string;
  talhaoId: string;
  talhao: { id: string; nome: string; codigo?: string | null };
  areaHa?: number | null;
  custoRateado?: number | null;
}

// "Operação" na interface; Atividade é o nome da entidade no banco.
export interface Atividade {
  id: string;
  data: string;
  observacoes?: string | null;
  origem: "WEB" | "APP";
  tipoAtividadeId: string;
  tipoAtividade: TipoAtividade;
  executorId?: string | null;
  executor?: Executor | null;
  custoMaoDeObra?: number | null;
  responsavel: { id: string; nome: string };
  talhoes: AtividadeTalhao[];
  insumos: AtividadeInsumo[];
}

export interface MovimentacaoEstoque {
  id: string;
  insumoId: string;
  insumo: Insumo;
  tipo: "ENTRADA" | "SAIDA" | "AJUSTE";
  origem: "COMPRA" | "USO_ATIVIDADE" | "AJUSTE" | "OUTRO";
  quantidade: number;
  data: string;
  observacoes?: string | null;
  loteId?: string | null;
  custoUnitario?: number | null;
  custoTotal?: number | null;
}

export interface Colheita {
  id: string;
  talhaoId: string;
  talhao: { id: string; nome: string; codigo?: string | null; areaHa?: number | null };
  safraId?: string | null;
  safra?: Safra | null;
  data: string;
  // lançamento de campo
  quantidadeCaixas: number;
  executorId?: string | null;
  executor?: Executor | null;
  valorPorCaixa?: number | null;
  custoColheita?: number | null;
  origem: "WEB" | "APP";
  // complemento comercial
  pesoTotalKg?: number | null;
  pesoRefugoKg?: number | null;
  valorTotalVenda?: number | null;
  classificacao?: string | null;
  observacoes?: string | null;
  // derivados calculados pelo servidor
  kgPorCaixa?: number | null;
  pesoLiquidoKg?: number | null;
  percentualRefugo?: number | null;
  margem?: number | null;
  caixasPorHectare?: number | null;
}

export interface ResumoColheitaTalhao {
  talhaoId: string;
  nome: string;
  codigo?: string | null;
  areaHa?: number | null;
  caixas: number;
  custoColheita: number;
  receita: number;
  margem: number;
  caixasPorHectare?: number | null;
  kgPorCaixa?: number | null;
}

export interface PerfilCorrecaoSolo {
  id: string;
  nome: string;
  culturaId: string;
  cultura?: Cultura;
  phIdealMin?: number | null;
  phIdealMax?: number | null;
  materiaOrganicaIdeal?: number | null;
  fosforoIdeal?: number | null;
  potassioIdeal?: number | null;
  calcioIdeal?: number | null;
  magnesioIdeal?: number | null;
  saturacaoBasesIdeal?: number | null;
  ctcReferencia?: number | null;
  observacoes?: string | null;
}

export interface AnaliseSolo {
  id: string;
  talhaoId: string;
  dataColeta: string;
  profundidadeCm?: number | null;
  laboratorio?: string | null;
  ph?: number | null;
  materiaOrganica?: number | null;
  fosforo?: number | null;
  potassio?: number | null;
  calcio?: number | null;
  magnesio?: number | null;
  aluminio?: number | null;
  hAl?: number | null;
  somaBases?: number | null;
  ctc?: number | null;
  saturacaoBases?: number | null;
  observacoes?: string | null;
}

export interface AnaliseFoliar {
  id: string;
  talhaoId: string;
  dataColeta: string;
  estadioFenologico?: string | null;
  nitrogenio?: number | null;
  fosforo?: number | null;
  potassio?: number | null;
  calcio?: number | null;
  magnesio?: number | null;
  enxofre?: number | null;
  observacoes?: string | null;
}

export interface ParametroDiagnostico {
  parametro: string;
  valorMedido: number | null;
  faixaIdealMin: number | null;
  faixaIdealMax: number | null;
  status: "BAIXO" | "ADEQUADO" | "ALTO" | "SEM_REFERENCIA";
}

export interface DiagnosticoResposta {
  possuiAnalise: boolean;
  mensagem?: string;
  possuiPerfil?: boolean;
  perfilNome?: string;
  parametros?: ParametroDiagnostico[];
  necessidadeCalagemToneladasPorHectare?: number | null;
  observacaoCalagem?: string | null;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: "ADMIN" | "GERENTE" | "ENCARREGADO";
  ativo: boolean;
}

export type ModuloId =
  | "dashboard"
  | "mapa"
  | "colheitas"
  | "operacoes"
  | "estoque"
  | "pragas"
  | "irrigacao"
  | "analises"
  | "cadastros"
  | "propriedade"
  | "usuarios";

export interface Permissao {
  modulo: string;
  podeVer: boolean;
  podeEditar: boolean;
}

export interface ModuloDescricao {
  id: ModuloId;
  rotulo: string;
  descricao: string;
}

export interface LinhaMatrizPermissao {
  papel: "ADMIN" | "GERENTE" | "ENCARREGADO";
  fixo?: boolean;
  permissoes: Permissao[];
}

export interface RespostaPermissoes {
  modulos: ModuloDescricao[];
  matriz: LinhaMatrizPermissao[];
}
