import cron from "node-cron";
import type { PrismaClient } from "@erpsitio/db";
import { sateliteConfigurado } from "./satelite.js";
import { sincronizarLeiturasSatelite } from "./sincronizacaoSatelite.js";
import { emailNotasConfigurado, sincronizarCaixaDeNotas } from "./emailNotas.js";

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
}
