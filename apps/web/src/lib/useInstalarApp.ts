import { useEffect, useState } from "react";

/**
 * Instalação do app na tela inicial do Android.
 *
 * O Chrome dispara `beforeinstallprompt` quando o site cumpre os requisitos de
 * PWA (manifesto válido, service worker, HTTPS) e o usuário já demonstrou
 * algum uso. Guardamos o evento para poder oferecer a instalação num botão
 * nosso — o banner nativo é discreto e passa despercebido no campo.
 *
 * No iOS o evento não existe: lá a instalação é manual, pelo menu Compartilhar
 * do Safari. Por isso `instalavel` pode ser false mesmo dando para instalar.
 */

interface EventoInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const CHAVE_DISPENSADO = "erpsitio_instalacao_dispensada";

export function useInstalarApp() {
  const [evento, setEvento] = useState<EventoInstalacao | null>(null);
  const [dispensado, setDispensado] = useState(
    () => localStorage.getItem(CHAVE_DISPENSADO) === "1",
  );

  useEffect(() => {
    const aoPoderInstalar = (e: Event) => {
      e.preventDefault(); // sem isto o Chrome mostra o banner dele
      setEvento(e as EventoInstalacao);
    };
    const aoInstalar = () => setEvento(null);

    window.addEventListener("beforeinstallprompt", aoPoderInstalar);
    window.addEventListener("appinstalled", aoInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", aoPoderInstalar);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  // Já aberto como app instalado: não faz sentido oferecer instalação.
  const jaInstalado =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;

  async function instalar() {
    if (!evento) return false;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    setEvento(null);
    return outcome === "accepted";
  }

  function dispensar() {
    localStorage.setItem(CHAVE_DISPENSADO, "1");
    setDispensado(true);
  }

  return {
    instalavel: !!evento && !jaInstalado && !dispensado,
    jaInstalado,
    instalar,
    dispensar,
  };
}
