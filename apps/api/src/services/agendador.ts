import cron from "node-cron";
import type { PrismaClient } from "@erpsitio/db";
import { sateliteConfigurado } from "./satelite.js";
import { sincronizarLeiturasSatelite } from "./sincronizacaoSatelite.js";

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
}
