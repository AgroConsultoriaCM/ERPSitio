import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Inbox, type LucideProps } from "lucide-react";

/**
 * Peças visuais compartilhadas. Existem para que "um número importante" tenha
 * a mesma cara no painel e no celular, e para que tela sem dado nenhum ainda
 * diga ao usuário o que fazer em vez de mostrar um vazio mudo.
 */

export type Tom = "mata" | "limao" | "agua" | "alerta" | "perigo" | "neutro";

const TOM_TEXTO: Record<Tom, string> = {
  mata: "text-mata-700",
  limao: "text-limao-700",
  agua: "text-agua-700",
  alerta: "text-amber-700",
  perigo: "text-red-700",
  neutro: "text-terra-800",
};

const TOM_ICONE: Record<Tom, string> = {
  mata: "bg-mata-50 text-mata-600 ring-mata-100",
  limao: "bg-limao-50 text-limao-700 ring-limao-100",
  agua: "bg-agua-50 text-agua-600 ring-agua-100",
  alerta: "bg-amber-50 text-amber-600 ring-amber-100",
  perigo: "bg-red-50 text-red-600 ring-red-100",
  neutro: "bg-terra-100 text-terra-500 ring-terra-200",
};

const TOM_CAIXA: Record<Tom, string> = {
  mata: "border-mata-200/70 bg-mata-50",
  limao: "border-limao-200/70 bg-limao-50",
  agua: "border-agua-200/70 bg-agua-50",
  alerta: "border-amber-200/70 bg-amber-50",
  perigo: "border-red-200/70 bg-red-50",
  neutro: "border-terra-200/70 bg-terra-50",
};

/** Faixa de brilho no topo do cartão, no tom do assunto. */
const TOM_FILETE: Record<Tom, string> = {
  mata: "from-mata-400 to-mata-600",
  limao: "from-limao-300 to-limao-500",
  agua: "from-agua-300 to-agua-500",
  alerta: "from-amber-300 to-amber-500",
  perigo: "from-red-300 to-red-500",
  neutro: "from-terra-300 to-terra-400",
};

type Icone = ComponentType<LucideProps>;

export function Cartao({
  children,
  className = "",
  interativo = false,
}: {
  children: ReactNode;
  className?: string;
  interativo?: boolean;
}) {
  return (
    <div className={`${interativo ? "cartao-interativo" : "cartao"} p-4 sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

export function TituloSecao({
  children,
  acao,
  descricao,
  icone: Ico,
}: {
  children: ReactNode;
  acao?: ReactNode;
  descricao?: string;
  icone?: Icone;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-4">
      <div className="flex items-start gap-2.5">
        {Ico && (
          <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-terra-100 text-terra-500">
            <Ico size={15} strokeWidth={2} />
          </span>
        )}
        <div>
          <h2 className="text-base font-semibold tracking-tight text-terra-900">{children}</h2>
          {descricao && <p className="mt-0.5 text-sm leading-snug text-terra-500">{descricao}</p>}
        </div>
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  );
}

/**
 * Número de destaque.
 *
 * O ícone à direita e o filete colorido no topo são o que permite bater o olho
 * e saber do que se trata sem ler o rótulo — verde é dinheiro e área, limão é
 * colheita, azul é água.
 */
export function Indicador({
  titulo,
  valor,
  unidade,
  detalhe,
  tom = "neutro",
  icone: Ico,
  link,
  destaque = false,
  className = "",
}: {
  titulo: string;
  valor: string | number;
  unidade?: string;
  detalhe?: string;
  tom?: Tom;
  icone?: Icone;
  link?: string;
  /** Ocupa mais espaço e usa tipografia maior. Um por painel, no máximo. */
  destaque?: boolean;
  /** Para posicionar na grade (col-span, row-span) sem vazar estilo para dentro. */
  className?: string;
}) {
  const conteudo = (
    <>
      <span
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${TOM_FILETE[tom]}`}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <p className="rotulo">{titulo}</p>
        {Ico && (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 transition-transform duration-300 ease-suave group-hover:scale-110 ${TOM_ICONE[tom]}`}
          >
            <Ico size={16} strokeWidth={2} />
          </span>
        )}
      </div>
      <p
        className={`numero mt-2 font-bold leading-none ${
          destaque ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl"
        } ${TOM_TEXTO[tom]}`}
      >
        {valor}
        {unidade && (
          <span className="ml-1.5 text-base font-semibold opacity-60">{unidade}</span>
        )}
      </p>
      <p className="mt-1.5 min-h-[1rem] text-xs leading-snug text-terra-500">{detalhe ?? ""}</p>
    </>
  );

  const base = `group relative flex flex-col justify-center overflow-hidden ${
    destaque ? "p-5 sm:p-6" : "p-4"
  } pt-5 ${className}`;

  if (link) {
    return (
      <Link to={link} className={`cartao-interativo ${base}`}>
        {conteudo}
      </Link>
    );
  }
  return <div className={`cartao ${base}`}>{conteudo}</div>;
}

/**
 * Tela sem dado ainda. Nunca deixar só "nenhum registro": o sistema é novo e
 * quase tudo está vazio no começo — o vazio precisa ensinar o próximo passo.
 */
export function EstadoVazio({
  titulo,
  descricao,
  acao,
  icone: Ico = Inbox,
  tom = "neutro",
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
  icone?: Icone;
  tom?: Tom;
}) {
  return (
    <div className="flex animate-surgir flex-col items-center justify-center px-6 py-12 text-center">
      <div
        className={`mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${TOM_ICONE[tom]}`}
      >
        <Ico size={22} strokeWidth={1.75} />
      </div>
      <p className="font-semibold text-terra-800">{titulo}</p>
      {descricao && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-terra-500">{descricao}</p>
      )}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}

export function Aviso({
  tom = "alerta",
  titulo,
  children,
  acao,
  icone: Ico,
}: {
  tom?: Tom;
  titulo: string;
  children?: ReactNode;
  acao?: ReactNode;
  icone?: Icone;
}) {
  return (
    <div className={`rounded-xl border p-4 ${TOM_CAIXA[tom]}`}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className={`flex items-center gap-2 font-semibold ${TOM_TEXTO[tom]}`}>
          {Ico && <Ico size={16} strokeWidth={2.25} className="shrink-0" />}
          {titulo}
        </p>
        {acao}
      </div>
      <div className={`text-sm leading-relaxed ${TOM_TEXTO[tom]}`}>{children}</div>
    </div>
  );
}

export function Etiqueta({ tom = "neutro", children }: { tom?: Tom; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${TOM_CAIXA[tom]} ${TOM_TEXTO[tom]}`}
    >
      {children}
    </span>
  );
}

/** Envelope de tabela: estilo de cabeçalho único e rolagem lateral no celular. */
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
          <thead className="border-b border-terra-200 bg-terra-50/80">
            <tr>
              {cabecalho.map((c) => (
                <th key={c} className="whitespace-nowrap px-4 py-3 rotulo">
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

/** Bloco cinza no lugar do conteúdo que ainda está carregando. */
export function Esqueleto({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`esqueleto ${className}`} />;
}

export function EsqueletoIndicador() {
  return (
    <div className="cartao p-4 pt-5">
      <Esqueleto className="h-2.5 w-20" />
      <Esqueleto className="mt-3 h-8 w-28" />
      <Esqueleto className="mt-2.5 h-2.5 w-16" />
    </div>
  );
}

export const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const numero = (v: number | null | undefined, casas = 1) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: casas });
