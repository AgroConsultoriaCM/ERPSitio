import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle,
  CloudUpload,
  Citrus,
  Download,
  Loader2,
  LogOut,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useOnline } from "../../lib/useOnline";
import { useInstalarApp } from "../../lib/useInstalarApp";
import { db } from "../../offline/db";
import { reenviarComErro, sincronizarPendentes } from "../../offline/sync";

export default function CampoLayout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const online = useOnline();
  const instalacao = useInstalarApp();
  const [sincronizando, setSincronizando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  // Conta operações e colheitas juntas: para o encarregado é uma fila só.
  const pendentes = useLiveQuery(
    async () =>
      (await db.atividadesPendentes.where("status").equals("pendente").count()) +
      (await db.colheitasPendentes.where("status").equals("pendente").count()),
    [],
    0,
  );
  const comErro = useLiveQuery(
    async () =>
      (await db.atividadesPendentes.where("status").equals("erro").count()) +
      (await db.colheitasPendentes.where("status").equals("erro").count()),
    [],
    0,
  );

  async function sincronizarAgora(reenviar = false) {
    setSincronizando(true);
    setRecado(null);
    try {
      const r = reenviar ? await reenviarComErro() : await sincronizarPendentes();
      if (r.semRede) setRecado("Sem sinal agora — os lançamentos continuam guardados.");
      else if (r.enviados > 0)
        setRecado(
          `${r.enviados} lançamento${r.enviados > 1 ? "s" : ""} enviado${r.enviados > 1 ? "s" : ""}.`,
        );
      else if (r.falhas > 0) setRecado(`${r.falhas} lançamento(s) recusado(s) pelo servidor.`);
      else setRecado("Nada para enviar.");
    } finally {
      setSincronizando(false);
      setTimeout(() => setRecado(null), 6000);
    }
  }

  return (
    <div className="min-h-screen bg-terra-100 pb-8">
      <header className="sticky top-0 z-10 bg-gradient-to-b from-mata-700 to-mata-800 px-4 pb-2.5 pt-3 text-white shadow-cartao-alto">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link to="/campo" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <Citrus size={18} strokeWidth={2} />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-bold leading-tight tracking-tight">
                Sítio · Campo
              </span>
              <span className="block truncate text-xs text-mata-100">{usuario?.nome}</span>
            </span>
          </Link>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mata-900/40 transition active:scale-95"
            aria-label="Sair"
          >
            <LogOut size={17} />
          </button>
        </div>

        <div className="mx-auto mt-2.5 flex max-w-md flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 font-medium">
            {online ? (
              <Wifi size={13} className="text-limao-300" />
            ) : (
              <WifiOff size={13} className="animate-pulsar text-amber-300" />
            )}
            {online ? "Conectado" : "Sem sinal — fica no aparelho"}
          </span>

          {!!pendentes && (
            <button
              onClick={() => sincronizarAgora()}
              disabled={sincronizando}
              className="ml-auto flex items-center gap-1.5 rounded-full bg-amber-400 px-2.5 py-1 font-semibold text-amber-950 transition active:scale-95 disabled:opacity-70"
            >
              {sincronizando ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <CloudUpload size={12} />
              )}
              {sincronizando ? "enviando…" : `${pendentes} aguardando`}
            </button>
          )}

          {!!comErro && (
            <button
              onClick={() => sincronizarAgora(true)}
              disabled={sincronizando}
              className="flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-1 font-semibold text-white transition active:scale-95 disabled:opacity-70"
            >
              <AlertTriangle size={12} />
              {comErro} com erro — tentar
            </button>
          )}
        </div>

        {recado && (
          <p className="mx-auto mt-2 max-w-md animate-surgir rounded-lg bg-mata-900/50 px-2.5 py-1.5 text-xs">
            {recado}
          </p>
        )}
      </header>

      <main className="mx-auto max-w-md px-4 py-4">
        {instalacao.instalavel && (
          <div className="mb-4 flex animate-surgir-de-baixo items-center gap-3 rounded-2xl border border-mata-200 bg-white p-3 shadow-cartao">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-mata-500 to-mata-700 text-white">
              <Download size={20} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-terra-900">Instalar no celular</p>
              <p className="text-xs leading-snug text-terra-500">
                Abre como aplicativo e funciona sem sinal.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => instalacao.instalar()}
                className="rounded-lg bg-mata-600 px-3 py-2 text-sm font-semibold text-white transition active:scale-95"
              >
                Instalar
              </button>
              <button
                onClick={instalacao.dispensar}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-terra-400 transition active:scale-95"
                aria-label="Agora não"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <Outlet />
      </main>
    </div>
  );
}
