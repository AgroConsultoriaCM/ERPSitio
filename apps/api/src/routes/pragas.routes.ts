import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { NaoEncontradoError } from "../lib/errors.js";
import type { FuncaoInsumo } from "@erpsitio/db";

const regraSchema = z.object({
  nome: z.string().min(1),
  funcao: z.enum([
    "INSETICIDA",
    "FUNGICIDA",
    "HERBICIDA",
    "ACARICIDA",
    "NEMATICIDA",
    "NUTRICAO_FOLIAR",
    "FERTILIZANTE_SOLO",
    "ADJUVANTE",
    "OUTRO",
  ]),
  intervaloDias: z.number().int().positive(),
  escopo: z.enum(["TODOS_TALHOES", "GRUPO", "TALHAO"]).default("TODOS_TALHOES"),
  grupoId: z.string().uuid().optional().nullable(),
  talhaoId: z.string().uuid().optional().nullable(),
  ativo: z.boolean().optional(),
  observacoes: z.string().optional(),
});

const diasEntre = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / 86_400_000);

export default async function pragasRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("pragas", "VER"));

  /**
   * Ultima aplicacao de cada funcao de produto, por talhao.
   * Percorre as operacoes que usaram insumo com funcao definida e guarda a
   * data mais recente de cada par (talhao, funcao).
   */
  async function ultimasAplicacoes(propriedadeId: string) {
    const usos = await fastify.prisma.atividadeInsumo.findMany({
      where: {
        atividade: { propriedadeId },
        // isEmpty: false = o produto tem ao menos uma funcao declarada
        insumo: { funcoes: { isEmpty: false } },
      },
      include: {
        insumo: { select: { funcoes: true, nome: true } },
        atividade: {
          select: {
            data: true,
            talhoes: { select: { talhaoId: true } },
          },
        },
      },
      orderBy: { atividade: { data: "desc" } },
    });

    // chave: `${talhaoId}|${funcao}`
    const mapa = new Map<string, { data: Date; produto: string }>();
    for (const uso of usos) {
      // Um produto pode ser fungicida E acaricida. Aplicar uma vez conta para
      // as duas funcoes - antes, com uma funcao so, o alerta da outra
      // continuava vencido sem motivo.
      for (const funcao of uso.insumo.funcoes) {
        for (const t of uso.atividade.talhoes) {
          const chave = `${t.talhaoId}|${funcao}`;
          const atual = mapa.get(chave);
          if (!atual || uso.atividade.data > atual.data) {
            mapa.set(chave, { data: uso.atividade.data, produto: uso.insumo.nome });
          }
        }
      }
    }
    return mapa;
  }

  // Matriz talhao x funcao com a ultima aplicacao - alimenta o painel de pragas
  fastify.get("/pragas/ultimas-aplicacoes", async (request) => {
    const [talhoes, mapa] = await Promise.all([
      fastify.prisma.talhao.findMany({
        where: { propriedadeId: request.user.propriedadeId },
        select: { id: true, nome: true, codigo: true },
        orderBy: { codigo: "asc" },
      }),
      ultimasAplicacoes(request.user.propriedadeId),
    ]);

    const hoje = new Date();
    return talhoes.map((t) => {
      const aplicacoes: Record<string, { data: string; diasAtras: number; produto: string }> = {};
      for (const [chave, valor] of mapa) {
        const [talhaoId, funcao] = chave.split("|");
        if (talhaoId !== t.id) continue;
        aplicacoes[funcao] = {
          data: valor.data.toISOString(),
          diasAtras: diasEntre(hoje, valor.data),
          produto: valor.produto,
        };
      }
      return { talhaoId: t.id, nome: t.nome, codigo: t.codigo, aplicacoes };
    });
  });

  /**
   * Alertas: para cada regra ativa, verifica os talhoes do seu escopo e
   * devolve os que estao vencidos (ou nunca receberam aquela funcao).
   */
  fastify.get("/pragas/alertas", async (request) => {
    const propriedadeId = request.user.propriedadeId;
    const [regras, mapa] = await Promise.all([
      fastify.prisma.regraAlerta.findMany({ where: { propriedadeId, ativo: true } }),
      ultimasAplicacoes(propriedadeId),
    ]);

    const hoje = new Date();
    const alertas: {
      regraId: string;
      regraNome: string;
      funcao: FuncaoInsumo;
      intervaloDias: number;
      talhaoId: string;
      talhaoNome: string;
      talhaoCodigo: string | null;
      ultimaAplicacao: string | null;
      diasDesdeUltima: number | null;
      diasVencido: number | null;
      nuncaAplicado: boolean;
    }[] = [];

    for (const regra of regras) {
      let talhoes;
      if (regra.escopo === "TALHAO" && regra.talhaoId) {
        talhoes = await fastify.prisma.talhao.findMany({
          where: { id: regra.talhaoId, propriedadeId },
          select: { id: true, nome: true, codigo: true },
        });
      } else if (regra.escopo === "GRUPO" && regra.grupoId) {
        const itens = await fastify.prisma.grupoTalhaoItem.findMany({
          where: { grupoId: regra.grupoId, grupo: { propriedadeId } },
          include: { talhao: { select: { id: true, nome: true, codigo: true } } },
        });
        talhoes = itens.map((i) => i.talhao);
      } else {
        talhoes = await fastify.prisma.talhao.findMany({
          where: { propriedadeId, status: "ATIVO" },
          select: { id: true, nome: true, codigo: true },
        });
      }

      for (const t of talhoes) {
        const ultima = mapa.get(`${t.id}|${regra.funcao}`);
        const dias = ultima ? diasEntre(hoje, ultima.data) : null;
        const vencido = dias == null || dias >= regra.intervaloDias;
        if (!vencido) continue;

        alertas.push({
          regraId: regra.id,
          regraNome: regra.nome,
          funcao: regra.funcao,
          intervaloDias: regra.intervaloDias,
          talhaoId: t.id,
          talhaoNome: t.nome,
          talhaoCodigo: t.codigo,
          ultimaAplicacao: ultima ? ultima.data.toISOString() : null,
          diasDesdeUltima: dias,
          diasVencido: dias == null ? null : dias - regra.intervaloDias,
          nuncaAplicado: !ultima,
        });
      }
    }

    // mais atrasados primeiro; "nunca aplicado" no topo
    return alertas.sort((a, b) => {
      if (a.nuncaAplicado !== b.nuncaAplicado) return a.nuncaAplicado ? -1 : 1;
      return (b.diasVencido ?? 0) - (a.diasVencido ?? 0);
    });
  });

  fastify.get("/pragas/regras", async (request) => {
    return fastify.prisma.regraAlerta.findMany({
      where: { propriedadeId: request.user.propriedadeId },
      orderBy: { nome: "asc" },
    });
  });

  fastify.post(
    "/pragas/regras",
    { preHandler: fastify.requirePermissao("pragas", "EDITAR") },
    async (request, reply) => {
      const dados = regraSchema.parse(request.body);
      const regra = await fastify.prisma.regraAlerta.create({
        data: { ...dados, propriedadeId: request.user.propriedadeId },
      });
      return reply.status(201).send(regra);
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/pragas/regras/:id",
    { preHandler: fastify.requirePermissao("pragas", "EDITAR") },
    async (request, reply) => {
      const dados = regraSchema.partial().parse(request.body);
      const existente = await fastify.prisma.regraAlerta.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      const regra = await fastify.prisma.regraAlerta.update({
        where: { id: existente.id },
        data: dados,
      });
      return reply.send(regra);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/pragas/regras/:id",
    { preHandler: fastify.requirePermissao("pragas", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.regraAlerta.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      await fastify.prisma.regraAlerta.delete({ where: { id: existente.id } });
      return reply.status(204).send();
    },
  );
}
