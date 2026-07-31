import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Peças visuais compartilhadas. Existem para que "um número importante" tenha
 * a mesma cara no painel e no celular, e para que tela sem dado nenhum ainda
 * diga ao usuário o que fazer em vez de mostrar um vazio mudo.
 */

type Tom = "mata" | "limao" | "agua" | "alerta" | "perigo" | "neutro";

const TOM_TEXTO: Record<Tom, string> = {
  mata: "text-mata-700",
  limao: "text-limao-700",
  agua: "text-agua-700",
  alerta: "text-amber-700",
  perigo: "text-red-700",
  neutro: "text-terra-800",
};

const TOM_FAIXA: Record<Tom, string> = {
  mata: "bg-mata-500",
  limao: "bg-limao-500",
  agua: "bg-agua-500",
  alerta: "bg-amber-500",
  perigo: "bg-red-500",
  neutro: "bg-terra-400",
};

const TOM_CAIXA: Record<Tom, string> = {
  mata: "border-mata-200 bg-mata-50",
  limao: "border-limao-200 bg-limao-50",
  agua: "border-agua-200 bg-agua-50",
  alerta: "border-amber-200 bg-amber-50",
  perigo: "border-red-200 bg-red-50",
  neutro: "border-terra-200 bg-terra-50",
};

export function Cartao({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`cartao p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function TituloSecao({
  children,
  acao,
  descricao,
}: {
  children: ReactNode;
  acao?: ReactNode;
  descricao?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-terra-900">{children}</h2>
        {descricao && <p className="mt-0.5 text-sm text-terra-500">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}

/**
 * Número de destaque. A faixa colorida no topo é o que permite bater o olho e
 * saber do que se trata sem ler o rótulo — verde é dinheiro/área, limão é
 * colheita, azul é água.
 */
export function Indicador({
  titulo,
  valor,
  unidade,
  detalhe,
  tom = "neutro",
  link,
}: {
  titulo: string;
  valor: string | number;
  unidade?: string;
  detalhe?: string;
  tom?: Tom;
  link?: string;
}) {
  const conteudo = (
    <>
      <span className={`absolute inset-x-0 top-0 h-1 rounded-t-xl ${TOM_FAIXA[tom]}`} />
      <p className="rotulo">{titulo}</p>
      <p className={`numero mt-1.5 text-2xl font-bold sm:text-3xl ${TOM_TEXTO[tom]}`}>
        {valor}
        {unidade && <span className="ml-1 text-base font-semibold opacity-70">{unidade}</span>}
      </p>
      <p className="mt-1 min-h-[1rem] text-xs text-terra-500">{detalhe ?? ""}</p>
    </>
  );

  const base = "cartao relative overflow-hidden p-4 pt-5";

  if (link) {
    return (
      <Link to={link} className={`${base} transition hover:shadow-cartao-alto`}>
        {conteudo}
      </Link>
    );
  }
  return <div className={base}>{conteudo}</div>;
}

/**
 * Tela sem dado ainda. Nunca deixar só "nenhum registro": o sistema é novo e
 * quase tudo está vazio no começo — o vazio precisa ensinar o próximo passo.
 */
export function EstadoVazio({
  titulo,
  descricao,
  acao,
  icone = "•",
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
  icone?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-terra-100 text-lg text-terra-400">
        {icone}
      </div>
      <p className="font-medium text-terra-700">{titulo}</p>
      {descricao && <p className="mt-1 max-w-sm text-sm text-terra-500">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

export function Aviso({
  tom = "alerta",
  titulo,
  children,
  acao,
}: {
  tom?: Tom;
  titulo: string;
  children?: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-4 ${TOM_CAIXA[tom]}`}>
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className={`font-semibold ${TOM_TEXTO[tom]}`}>{titulo}</p>
        {acao}
      </div>
      <div className={`text-sm ${TOM_TEXTO[tom]}`}>{children}</div>
    </div>
  );
}

export function Etiqueta({ tom = "neutro", children }: { tom?: Tom; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TOM_CAIXA[tom]} ${TOM_TEXTO[tom]}`}
    >
      {children}
    </span>
  );
}

/** Envelope de tabela: cabeçalho fixo de estilo e rolagem lateral no celular. */
export function Tabela({
  cabecalho,
  children,
  vazio,
}: {
  cabecalho: string[];
  children: ReactNode;
  vazio?: ReactNode;
}) {
  return (
    <div className="cartao overflow-hidden">
      <div className="overflow-x-auto rolagem-fina">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-terra-200 bg-terra-50">
            <tr>
              {cabecalho.map((c) => (
                <th key={c} className="whitespace-nowrap px-4 py-2.5 rotulo">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-terra-100">{children}</tbody>
        </table>
      </div>
      {vazio}
    </div>
  );
}

export const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const numero = (v: number | null | undefined, casas = 1) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: casas });
