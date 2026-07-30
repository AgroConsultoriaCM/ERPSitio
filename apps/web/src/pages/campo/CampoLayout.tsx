import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "../../lib/auth";
import { db } from "../../offline/db";
import { sincronizarPendentes } from "../../offline/sync";

export default function CampoLayout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [online, setOnline] = useState(navigator.onLine);
  // conta operacoes e colheitas juntas: para o encarregado e uma fila so
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

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <div className="min-h-screen bg-green-50 pb-6">
      <header className="sticky top-0 z-10 bg-green-700 px-4 py-3 text-white shadow">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/campo" className="text-lg font-bold">
              Sítio - Campo
            </Link>
            <p className="text-xs text-green-100">{usuario?.nome}</p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="rounded-md bg-green-800 px-3 py-1 text-sm"
          >
            Sair
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className={`h-2 w-2 rounded-full ${online ? "bg-green-300" : "bg-yellow-300"}`} />
          <span>{online ? "Online" : "Offline — lançamentos serão guardados no aparelho"}</span>
          {!!pendentes && (
            <button
              onClick={() => sincronizarPendentes()}
              className="ml-auto rounded-full bg-yellow-400 px-2 py-0.5 font-semibold text-yellow-900"
            >
              {pendentes} pendente{pendentes > 1 ? "s" : ""} — sincronizar
            </button>
          )}
          {!!comErro && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 font-semibold text-white">
              {comErro} com erro
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
