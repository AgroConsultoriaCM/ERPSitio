import { api } from "./api";

const CHAVE_PUBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
export const MARCA_PEDIDO = "erpsitio_push_pedido";

// PushManager.subscribe espera a chave VAPID em bytes, nao na string base64
// que o servidor gera - conversao padrao (nao ha atalho na Push API).
function paraUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Normalizado = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(base64Normalizado);
  return Uint8Array.from([...bruto].map((c) => c.charCodeAt(0)));
}

export function pushSuportado(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && !!CHAVE_PUBLICA;
}

/** Já pedimos permissão antes nesse aparelho? Evita perguntar toda hora. */
export function jaPediuPermissao(): boolean {
  return localStorage.getItem(MARCA_PEDIDO) === "1";
}

export async function pedirPermissaoEInscrever(): Promise<boolean> {
  localStorage.setItem(MARCA_PEDIDO, "1");
  if (!pushSuportado()) return false;

  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") return false;

  const registration = await navigator.serviceWorker.ready;
  const inscricao = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: paraUint8Array(CHAVE_PUBLICA!) as BufferSource,
  });

  await api.post("/push/inscricao", inscricao.toJSON());
  return true;
}
