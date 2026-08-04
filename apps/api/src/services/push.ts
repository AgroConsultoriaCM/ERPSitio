import webpush from "web-push";
import type { PrismaClient, RolePapel } from "@erpsitio/db";
import { env } from "../env.js";

export function pushConfigurado(): boolean {
  return !!env.VAPID_PUBLIC_KEY && !!env.VAPID_PRIVATE_KEY && !!env.VAPID_SUBJECT;
}

let vapidConfigurado = false;
function garantirVapid() {
  if (vapidConfigurado) return;
  webpush.setVapidDetails(env.VAPID_SUBJECT!, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
  vapidConfigurado = true;
}

interface AvisoPush {
  title: string;
  body: string;
  /** rota do app que abre ao tocar no aviso */
  url?: string;
}

/**
 * Manda um aviso para todo usuario ativo de um papel numa propriedade.
 * Sem VAPID configurado vira no-op silencioso (mesmo criterio de
 * emailNotasConfigurado/sateliteConfigurado - integracao opcional).
 */
export async function enviarPushParaPapel(
  prisma: PrismaClient,
  propriedadeId: string,
  papel: RolePapel,
  aviso: AvisoPush,
) {
  if (!pushConfigurado()) return;
  garantirVapid();

  const usuarios = await prisma.usuario.findMany({
    where: { propriedadeId, role: papel, ativo: true },
    select: { id: true },
  });
  if (usuarios.length === 0) return;

  const inscricoes = await prisma.pushInscricao.findMany({
    where: { usuarioId: { in: usuarios.map((u) => u.id) } },
  });

  const payload = JSON.stringify(aviso);
  await Promise.all(
    inscricoes.map(async (inscricao) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: inscricao.endpoint,
            keys: { p256dh: inscricao.p256dh, auth: inscricao.authKey },
          },
          payload,
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410: o navegador/SO cancelou a inscricao (app desinstalado,
        // dado do dispositivo limpo) - reenviar so vai repetir o erro.
        if (status === 404 || status === 410) {
          await prisma.pushInscricao.delete({ where: { id: inscricao.id } }).catch(() => {});
        } else {
          console.error("[push] falha ao enviar:", err);
        }
      }
    }),
  );
}
