import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/client/index.js";

const prisma = new PrismaClient();

// Perfis de correcao de solo abaixo sao pontos de partida de referencia
// geral (literatura agronomica), NAO sao recomendacao tecnica definitiva.
// Devem ser revisados e ajustados por um agronomo responsavel pela
// propriedade em "/painel/perfis-correcao".
const PERFIS_REFERENCIA: Record<
  string,
  {
    phIdealMin: number;
    phIdealMax: number;
    materiaOrganicaIdeal: number;
    fosforoIdeal: number;
    potassioIdeal: number;
    calcioIdeal: number;
    magnesioIdeal: number;
    saturacaoBasesIdeal: number;
    ctcReferencia: number;
  }
> = {
  "Citros - Laranja Pera": {
    phIdealMin: 5.5,
    phIdealMax: 6.5,
    materiaOrganicaIdeal: 25,
    fosforoIdeal: 25,
    potassioIdeal: 3.5,
    calcioIdeal: 40,
    magnesioIdeal: 15,
    saturacaoBasesIdeal: 70,
    ctcReferencia: 80,
  },
  "Manga - Palmer": {
    phIdealMin: 5.5,
    phIdealMax: 6.5,
    materiaOrganicaIdeal: 20,
    fosforoIdeal: 20,
    potassioIdeal: 3.0,
    calcioIdeal: 35,
    magnesioIdeal: 12,
    saturacaoBasesIdeal: 65,
    ctcReferencia: 75,
  },
  "Uva - Itália": {
    phIdealMin: 5.8,
    phIdealMax: 6.8,
    materiaOrganicaIdeal: 22,
    fosforoIdeal: 30,
    potassioIdeal: 4.0,
    calcioIdeal: 45,
    magnesioIdeal: 15,
    saturacaoBasesIdeal: 75,
    ctcReferencia: 85,
  },
};

async function main() {
  const propriedade = await prisma.propriedade.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      nome: "Sítio Exemplo",
      localizacao: "Zona rural",
      latitude: -21.1775,
      longitude: -47.8103,
      poligono: {
        type: "Polygon",
        coordinates: [
          [
            [-47.813, -21.1748],
            [-47.8075, -21.1748],
            [-47.8075, -21.1782],
            [-47.813, -21.1782],
            [-47.813, -21.1748],
          ],
        ],
      },
    },
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@sitio.com.br";
  const adminSenha = process.env.SEED_ADMIN_SENHA ?? "troque-esta-senha-123";

  const admin = await prisma.usuario.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      nome: "Administrador",
      email: adminEmail,
      senhaHash: await bcrypt.hash(adminSenha, 10),
      role: "ADMIN",
      propriedadeId: propriedade.id,
    },
  });

  const encarregado = await prisma.usuario.upsert({
    where: { email: "encarregado@sitio.com.br" },
    update: {},
    create: {
      nome: "Encarregado de Campo",
      email: "encarregado@sitio.com.br",
      senhaHash: await bcrypt.hash("encarregado123", 10),
      role: "ENCARREGADO",
      propriedadeId: propriedade.id,
    },
  });

  const culturasNomes = ["Citros - Laranja Pera", "Manga - Palmer", "Uva - Itália"];
  const culturas: Record<string, { id: string }> = {};
  for (const nomeCompleto of culturasNomes) {
    const [nome, variedade] = nomeCompleto.split(" - ");
    const existente = await prisma.cultura.findFirst({
      where: { propriedadeId: propriedade.id, nome, variedade },
    });
    culturas[nomeCompleto] =
      existente ??
      (await prisma.cultura.create({
        data: { nome, variedade, propriedadeId: propriedade.id },
      }));
  }

  for (const [nomeCompleto, perfil] of Object.entries(PERFIS_REFERENCIA)) {
    const culturaNome = nomeCompleto.split(" - ")[0];
    const jaExiste = await prisma.perfilCorrecaoSolo.findFirst({
      where: { culturaNome, propriedadeId: propriedade.id },
    });
    if (!jaExiste) {
      await prisma.perfilCorrecaoSolo.create({
        data: {
          nome: `Perfil de referência - ${nomeCompleto}`,
          culturaNome,
          propriedadeId: propriedade.id,
          observacoes:
            "Ponto de partida genérico de literatura agronômica. Ajuste conforme o conhecimento técnico da propriedade.",
          ...perfil,
        },
      });
    }
  }

  const tiposAtividadeNomes = [
    "Poda",
    "Pulverização",
    "Irrigação",
    "Adubação",
    "Colheita",
    "Capina/Roçada",
  ];
  for (const nome of tiposAtividadeNomes) {
    const existente = await prisma.tipoAtividade.findFirst({
      where: { propriedadeId: propriedade.id, nome },
    });
    if (!existente) {
      await prisma.tipoAtividade.create({
        data: { nome, propriedadeId: propriedade.id },
      });
    }
  }

  const insumosSeed = [
    { nome: "Ureia", categoria: "FERTILIZANTE" as const, unidadeMedida: "kg", funcoes: ["FERTILIZANTE_SOLO" as const] },
    { nome: "Calcário Dolomítico", categoria: "FERTILIZANTE" as const, unidadeMedida: "kg", funcoes: ["FERTILIZANTE_SOLO" as const] },
    { nome: "Fungicida Base Cobre", categoria: "DEFENSIVO" as const, unidadeMedida: "L", funcoes: ["FUNGICIDA" as const] },
    { nome: "Caixa de Colheita 20kg", categoria: "EMBALAGEM" as const, unidadeMedida: "un", funcoes: [] },
  ];
  for (const insumo of insumosSeed) {
    const existente = await prisma.insumo.findFirst({
      where: { propriedadeId: propriedade.id, nome: insumo.nome },
    });
    if (!existente) {
      await prisma.insumo.create({
        data: { ...insumo, propriedadeId: propriedade.id },
      });
    }
  }

  const talhao1 = await prisma.talhao.findFirst({
    where: { propriedadeId: propriedade.id, nome: "Talhão 01 - Citros" },
  });
  const talhaoCitros =
    talhao1 ??
    (await prisma.talhao.create({
      data: {
        nome: "Talhão 01 - Citros",
        codigo: "T01",
        areaHa: 3.2,
        culturaId: culturas["Citros - Laranja Pera"].id,
        dataPlantio: new Date("2019-08-15"),
        status: "ATIVO",
        propriedadeId: propriedade.id,
        corMapa: "#f97316",
        poligono: {
          type: "Polygon",
          coordinates: [
            [
              [-47.8123, -21.1755],
              [-47.8103, -21.1755],
              [-47.8103, -21.1775],
              [-47.8123, -21.1775],
              [-47.8123, -21.1755],
            ],
          ],
        },
      },
    }));

  const talhao2 = await prisma.talhao.findFirst({
    where: { propriedadeId: propriedade.id, nome: "Talhão 02 - Manga" },
  });
  if (!talhao2) {
    await prisma.talhao.create({
      data: {
        nome: "Talhão 02 - Manga",
        codigo: "T02",
        areaHa: 2.5,
        culturaId: culturas["Manga - Palmer"].id,
        dataPlantio: new Date("2020-03-10"),
        status: "ATIVO",
        propriedadeId: propriedade.id,
        corMapa: "#eab308",
        poligono: {
          type: "Polygon",
          coordinates: [
            [
              [-47.8103, -21.1755],
              [-47.8083, -21.1755],
              [-47.8083, -21.1775],
              [-47.8103, -21.1775],
              [-47.8103, -21.1755],
            ],
          ],
        },
      },
    });
  }

  const jaTemAnalise = await prisma.analiseSolo.findFirst({
    where: { talhaoId: talhaoCitros.id },
  });
  if (!jaTemAnalise) {
    await prisma.analiseSolo.create({
      data: {
        talhaoId: talhaoCitros.id,
        propriedadeId: propriedade.id,
        dataColeta: new Date(),
        profundidadeCm: "0-20",
        laboratorio: "Laboratório Exemplo",
        ph: 5.1,
        materiaOrganica: 18,
        fosforo: 12,
        potassio: 2.1,
        calcio: 28,
        magnesio: 9,
        aluminio: 0.4,
        hAl: 35,
        somaBases: 39.1,
        ctc: 74.1,
        saturacaoBases: 52.8,
        observacoes: "Análise de exemplo gerada pelo seed.",
      },
    });
  }

  console.log("Seed concluído.");
  console.log(`Admin: ${adminEmail} / senha definida em SEED_ADMIN_SENHA`);
  console.log(`Encarregado: encarregado@sitio.com.br / encarregado123`);
  void admin;
  void encarregado;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
