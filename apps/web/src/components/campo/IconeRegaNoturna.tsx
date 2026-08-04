// Não existe ícone de regador no lucide-react - SVG próprio, no mesmo estilo
// (stroke, sem preenchimento) dos ícones lucide usados ao lado dele.
export default function IconeRegaNoturna({
  size = 20,
  strokeWidth = 2,
  className = "",
}: {
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M19 4.5a2.5 2.5 0 0 1-3 2.45A2.5 2.5 0 0 1 18.5 2a2.5 2.5 0 0 1 .5 2.5Z" />
      <path d="M3 13h9l3.5-2a1.5 1.5 0 0 1 2 2.1L15 15" />
      <path d="M3 13v3a2 2 0 0 0 2 2h6.5" />
      <path d="M8 18v2M11.5 18v2" />
      <path d="M15 15c.7 1 .7 2-1 3" />
    </svg>
  );
}
