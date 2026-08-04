import cron from "node-cron";
import type { PrismaClient } from "@erpsitio/db";
import { sateliteConfigurado } from "./satelite.js";
import { sincronizarLeiturasSatelite } from "./sincronizacaoSatelite.js";
import { emailNotasConfigurado, sincronizarCaixaDeNotas } from "./emailNotas.js";
import { enviarPushParaPapel } from "./push.js";
import { hojeBrasilia } from "../lib/data.js";

/**
 * Tarefas que rodam sozinhas, sem ninguem clicar em nada.
 *
 * Hoje so uma: a sincronizacao do satelite, todo domingo de madrugada. Antes
 * disso era um botao "Sincronizar agora" na tela de Manejo Nutricional - o
 * usuario preferiu tirar o clique do meio: a maior parte do que a tela
 * mostra ja esta em cache no banco, so falta o pedaco novo da semana.
 *
 * Roda DENTRO do processo da API (node-cron), nao no crontab do Ubuntu: assim
 * o agendamento viaja com o codigo no git, sem precisar mexer no servidor a
 * mao a cada deploy.
 */
export function agendarTarefas(prisma: PrismaClient) {
  // Domingo, 03:00, horario de Brasilia - mesma janela do backup do banco,
  // quando ninguem esta usando o sistema.
  cron.schedule(
    "0 3 * * 0",
    async () => {
      if (!sateliteConfigurado()) return;
      const propriedades = await prisma.propriedade.findMany({ select: { id: true } });
      for (const p of propriedades) {
        try {
          await sincronizarLeiturasSatelite(prisma, p.id);
        } catch (err) {
          console.error(`[agendador] falha ao sincronizar satelite da propriedade ${p.id}:`, err);
        }
      }
    },
    { timezone: "America/Sao_Paulo" },
  );

  // De hora em hora: a caixa recebe nota o dia inteiro (fornecedor nao avisa
  // quando manda), e reler so custa uma conexao IMAP - a dedupe por
  // chaveAcesso (notasEntrada.ts) cobre reenvio sem criar duplicata.
  cron.schedule(
    "0 * * * *",
    async () => {
      if (!emailNotasConfigurado()) return;
      const propriedades = await prisma.propriedade.findMany({ select: { id: true } });
      for (const p of propriedades) {
        try {
          const resumo = await sincronizarCaixaDeNotas(prisma, p.id);
          if (resumo.novas > 0 || resumo.recusadas.length > 0) {
            console.log(
              `[agendador] caixa de notas (${p.id}): ${resumo.novas} nova(s), ${resumo.repetidas} repetida(s), ${resumo.recusadas.length} recusada(s)`,
            );
          }
        } catch (err) {
          console.error(`[agendador] falha ao ler caixa de notas da propriedade ${p.id}:`, err);
        }
      }
    },
    { timezone: "America/Sao_Paulo" },
  );

  // 15h, todo dia: lembrete incondicional pra configurar a rega da noite -
  // nao depende de nada ja estar configurado, e so um empurrao de rotina.
  cron.schedule(
    "0 15 * * *",
    async () => {
      const propriedades = await prisma.propriedade.findMany({ select: { id: true } });
      for (const p of propriedades) {
        try {
          await enviarPushParaPapel(prisma, p.id, "ENCARREGADO", {
            title: "Rega noturna",
            body: "Configure os setores que vão regar hoje à noite.",
            url: "/campo/rega-noturna",
          });
        } catch (err) {
          console.error(`[agendador] falha ao avisar rega noturna da propriedade ${p.id}:`, err);
        }
      }
    },
    { timezone: "America/Sao_Paulo" },
  );

  // 6h45: pergunta do dia. O push so chama atencao - quem realmente
  // pergunta "hoje vamos colher?" e o pop-up no app (service worker nao
  // renderiza UI interativa).
  cron.schedule(
    "45 6 * * *",
    async () => {
      const propriedades = await prisma.propriedade.findMany({ select: { id: true } });
      for (const p of propriedades) {
        try {
          await enviarPushParaPapel(prisma, p.id, "ENCARREGADO", {
            title: "Bom dia",
            body: "Toque para responder: hoje vamos colher?",
            url: "/campo",
          });
        } catch (err) {
          console.error(`[agendador] falha ao avisar pergunta do dia da propriedade ${p.id}:`, err);
        }
      }
    },
    { timezone: "America/Sao_Paulo" },
  );

  // 15h30: lembrete condicional - so dispara se a resposta de hoje foi sim.
  cron.schedule(
    "30 15 * * *",
    async () => {
      const propriedades = await prisma.propriedade.findMany({ select: { id: true } });
      for (const p of propriedades) {
        try {
          const resposta = await prisma.respostaColheitaHoje.findUnique({
            where: { propriedadeId_data: { propriedadeId: p.id, data: hojeBrasilia() } },
          });
          if (resposta?.resposta !== true) continue;
          await enviarPushParaPapel(prisma, p.id, "ENCARREGADO", {
            title: "Colheita de hoje",
            body: "Não esqueça de lançar as colheitas do dia.",
            url: "/campo/colheita",
          });
        } catch (err) {
          console.error(`[agendador] falha ao avisar colheita de hoje da propriedade ${p.id}:`, err);
        }
      }
    },
    { timezone: "America/Sao_Paulo" },
  );
}
