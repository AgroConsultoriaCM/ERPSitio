import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError, NaoEncontradoError } from "../lib/errors.js";
import { criarAtividade, atividadeSchema } from "./atividades.routes.js";

// Uma pulverizacao e uma Atividade por baixo (mesmo estoque FIFO, mesmo
// controle de pragas por Insumo.funcoes), so o rateio do custo dos produtos
// entre talhoes usa METROS LINEARES percorridos, nao area - por isso pede
// talhoes diretos (nao grupo: precisa do espacamento de cada um).
const pulverizacaoSchema = z
  .object({
    clientId: z.string().min(1).optional(),
    data: z.coerce.date(),
    tipoAtividadeId: z.string().uuid(),
    executorId: z.string().uuid().optional().nullable(),
    safraId: z.string().uuid().optional().nullable(),
    observacoes: z.string().optional(),
    talhaoIds: z.array(z.string().uuid()).min(1),
    bombaId: z.string().uuid(),
    numeroCargas: z.number().positive(),
    caldaId: z.string().uuid().optional(),
    caldaAdHoc: z
      .array(z.object({ insumoId: z.string().uuid(), dosePor100L: z.number().positive() }))
      .min(1)
      .optional(),
  })
  .refine((d) => (d.caldaId != null) !== (d.caldaAdHoc != null), {
    message: "Informe uma calda cadastrada OU os itens da calda montada na hora, não os dois.",
    path: ["caldaId"],
  });

const INCLUDE_COMPLETO = {
  bomba: true,
  calda: { include: { itens: { include: { insumo: { select: { id: true, nome: true } } } } } },
  talhoes: { include: { talhao: { select: { id: true, nome: true, codigo: true } } } },
  atividade: {
    include: {
      talhoes: { include: { talhao: { select: { id: true, nome: true, codigo: true } } } },
      insumos: { include: { insumo: true } },
    },
  },
} as const;

export default async function pulverizacoesRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("operacoes", "VER"));

  fastify.get("/pulverizacoes", async (request) => {
    return fastify.prisma.registroPulverizacao.findMany({
      where: { propriedadeId: request.user.propriedadeId },
      include: INCLUDE_COMPLETO,
      orderBy: { data: "desc" },
      take: 200,
    });
  });

  fastify.post(
    "/pulverizacoes",
    { preHandler: fastify.requirePermissao("operacoes", "EDITAR") },
    async (request, reply) => {
      const dados = pulverizacaoSchema.parse(request.body);
      const propriedadeId = request.user.propriedadeId;

      const bomba = await fastify.prisma.perfilBomba.findFirst({
        where: { id: dados.bombaId, propriedadeId },
      });
      if (!bomba) throw new NaoEncontradoError("Perfil de bomba não encontrado");

      const talhoes = await fastify.prisma.talhao.findMany({
        where: { id: { in: dados.talhaoIds }, propriedadeId },
        select: { id: true, nome: true, areaHa: true, espacamentoEntreLinhas: true },
      });
      if (talhoes.length !== dados.talhaoIds.length) {
        throw new AppError("Um ou mais talhões informados não existem nesta propriedade.", 400);
      }
      const semEspacamento = talhoes.filter((t) => !t.areaHa || !t.espacamentoEntreLinhas);
      if (semEspacamento.length > 0) {
        throw new AppError(
          `Talhão(ões) sem área ou espaçamento entre linhas cadastrado, não dá para calcular metros lineares: ${semEspacamento.map((t) => t.nome).join(", ")}.`,
          422,
        );
      }

      // Metros lineares = area (m2) / espacamento entre linhas (m). E o peso
      // do rateio do custo do produto - nao a area, porque um talhao mais
      // adensado recebe mais linha percorrida na mesma area.
      const metrosPorTalhao = new Map<string, number>();
      for (const t of talhoes) {
        const metros = (t.areaHa! * 10000) / t.espacamentoEntreLinhas!;
        metrosPorTalhao.set(t.id, Math.round(metros * 100) / 100);
      }

      const volumeTotalLitros = Math.round(dados.numeroCargas * bomba.capacidadeLitros * 100) / 100;

      // Itens da calda: cadastrada ou montada na hora, mesma forma dos dois.
      let itensCalda: { insumoId: string; dosePor100L: number }[];
      if (dados.caldaId) {
        const calda = await fastify.prisma.calda.findFirst({
          where: { id: dados.caldaId, propriedadeId },
          include: { itens: true },
        });
        if (!calda) throw new NaoEncontradoError("Calda não encontrada");
        itensCalda = calda.itens;
      } else {
        const idsInformados = dados.caldaAdHoc!.map((i) => i.insumoId);
        const insumosValidos = await fastify.prisma.insumo.findMany({
          where: { id: { in: idsInformados }, propriedadeId },
          select: { id: true },
        });
        if (insumosValidos.length !== new Set(idsInformados).size) {
          throw new AppError("Algum produto da calda montada na hora não pertence a esta propriedade.", 422);
        }
        itensCalda = dados.caldaAdHoc!;
      }

      const insumosDb = await fastify.prisma.insumo.findMany({
        where: { id: { in: itensCalda.map((i) => i.insumoId) } },
        select: { id: true, unidadeMedida: true },
      });
      const unidadePorInsumo = new Map(insumosDb.map((i) => [i.id, i.unidadeMedida]));

      const insumosParaAtividade = itensCalda.map((item) => ({
        insumoId: item.insumoId,
        quantidade: Math.round(((volumeTotalLitros / 100) * item.dosePor100L) * 1000) / 1000,
        unidade: unidadePorInsumo.get(item.insumoId) ?? "",
      }));

      const dadosAtividade = atividadeSchema.parse({
        clientId: dados.clientId,
        tipoAtividadeId: dados.tipoAtividadeId,
        talhaoIds: dados.talhaoIds,
        grupoIds: [],
        executorId: dados.executorId,
        custoMaoDeObra: null,
        safraId: dados.safraId,
        data: dados.data,
        observacoes: dados.observacoes,
        origem: "WEB",
        insumos: insumosParaAtividade,
      });

      const { atividade } = await criarAtividade(
        fastify.prisma,
        propriedadeId,
        request.user.sub,
        dadosAtividade,
        metrosPorTalhao,
      );

      const registro = await fastify.prisma.registroPulverizacao.create({
        data: {
          data: dados.data,
          bombaId: dados.bombaId,
          numeroCargas: dados.numeroCargas,
          volumeTotalLitros,
          caldaId: dados.caldaId,
          caldaAdHoc: dados.caldaAdHoc ?? undefined,
          atividadeId: atividade.id,
          propriedadeId,
          talhoes: {
            create: talhoes.map((t) => ({
              talhaoId: t.id,
              metrosLineares: metrosPorTalhao.get(t.id)!,
            })),
          },
        },
        include: INCLUDE_COMPLETO,
      });

      return reply.status(201).send(registro);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/pulverizacoes/:id",
    { preHandler: fastify.requirePermissao("operacoes", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.registroPulverizacao.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      // Apaga a Atividade (cascade tira o RegistroPulverizacao junto) - assim
      // o estoque baixado precisa ser estornado à mão como qualquer exclusão
      // de operação hoje (não há estorno automático no DELETE de atividade).
      await fastify.prisma.atividade.delete({ where: { id: existente.atividadeId } });
      return reply.status(204).send();
    },
  );
}
