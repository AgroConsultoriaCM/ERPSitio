import { useEffect, useState } from "react";

/**
 * Estado da conexão.
 *
 * `navigator.onLine` só sabe se existe interface de rede — no campo é comum
 * ter sinal de dados e nenhuma rota até a API. Por isso o valor é corrigido
 * por quem realmente fala com o servidor: `api.ts` avisa quando uma chamada
 * falha por rede e quando volta a funcionar.
 */

const ouvintes = new Set<(online: boolean) => void>();
let ultimaFalhaDeRede = 0;

/** Chamado pela camada de API quando a requisição não alcançou o servidor. */
export function marcarFalhaDeRede() {
  ultimaFalhaDeRede = Date.now();
  ouvintes.forEach((f) => f(false));
}

/** Chamado pela camada de API quando uma resposta chegou. */
export function marcarRedeOk() {
  if (ultimaFalhaDeRede === 0) return;
  ultimaFalhaDeRede = 0;
  ouvintes.forEach((f) => f(navigator.onLine));
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine && ultimaFalhaDeRede === 0);

  useEffect(() => {
    const aoMudar = () => setOnline(navigator.onLine && ultimaFalhaDeRede === 0);
    const aoAvisar = (valor: boolean) => setOnline(valor && navigator.onLine);

    window.addEventListener("online", aoMudar);
    window.addEventListener("offline", aoMudar);
    ouvintes.add(aoAvisar);
    return () => {
      window.removeEventListener("online", aoMudar);
      window.removeEventListener("offline", aoMudar);
      ouvintes.delete(aoAvisar);
    };
  }, []);

  return online;
}
