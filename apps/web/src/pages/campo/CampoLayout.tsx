import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
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
        setRecado(`${r.enviados} lançamento${r.enviados > 1 ? "s" : ""} enviado${r.enviados > 1 ? "s" : ""}.`);
      else if (r.falhas > 0) setRecado(`${r.falhas} lançamento(s) recusado(s) pelo servidor.`);
      else setRecado("Nada para enviar.");
    } finally {
      setSincronizando(false);
      setTimeout(() => setRecado(null), 6000);
    }
  }

  return (
    <div className="min-h-screen bg-terra-100 pb-8">
      <header className="sticky top-0 z-10 bg-mata-700 px-4 pb-2.5 pt-3 text-white shadow-cartao-alto">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="min-w-0">
            <Link to="/campo" className="text-lg font-bold leading-tight">
              Sítio · Campo
            </Link>
            <p className="truncate text-xs text-mata-100">{usuario?.nome}</p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="shrink-0 rounded-lg bg-mata-800 px-3 py-1.5 text-sm font-medium"
          >
            Sair
          </button>
        </div>

        <div className="mx-auto mt-2 flex max-w-md flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${online ? "bg-limao-300" : "bg-amber-300"}`}
              aria-hidden
            />
            {online ? "Conectado" : "Sem sinal — lançamentos ficam no aparelho"}
          </span>

          {!!pendentes && (
            <button
              onClick={() => sincronizarAgora()}
              disabled={sincronizando}
              className="ml-auto rounded-full bg-amber-400 px-2.5 py-1 font-semibold text-amber-950 disabled:opacity-70"
            >
              {sincronizando
                ? "enviando…"
                : `${pendentes} aguardando — enviar agora`}
            </button>
          )}

          {!!comErro && (
            <button
              onClick={() => sincronizarAgora(true)}
              disabled={sincronizando}
              className="rounded-full bg-red-500 px-2.5 py-1 font-semibold text-white disabled:opacity-70"
            >
              {comErro} com erro — tentar de novo
            </button>
          )}
        </div>

        {recado && (
          <p className="mx-auto mt-1.5 max-w-md rounded-lg bg-mata-800/60 px-2.5 py-1 text-xs">
            {recado}
          </p>
        )}
      </header>

      <main className="mx-auto max-w-md px-4 py-4">
        {instalacao.instalavel && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-mata-200 bg-white p-3 shadow-cartao">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mata-600 text-lg font-bold text-white">
              S
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-terra-900">Instalar no celular</p>
              <p className="text-xs text-terra-500">
                Abre como aplicativo e funciona sem sinal.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <button
                onClick={() => instalacao.instalar()}
                className="rounded-lg bg-mata-600 px-3 py-1.5 text-sm font-semibold text-white"
              >
                Instalar
              </button>
              <button
                onClick={instalacao.dispensar}
                className="text-xs text-terra-400 underline"
              >
                agora não
              </button>
            </div>
          </div>
        )}

        <Outlet />
      </main>
    </div>
  );
}
