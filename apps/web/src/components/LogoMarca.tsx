/**
 * Marca da Costa Mello Agroconsultoria: fatia de cítrico com folha, no
 * estilo enviado (anéis concêntricos + raios + folha no canto superior).
 * SVG à mão porque não temos o arquivo-fonte da logo, só a imagem de
 * referência — cores batem com a paleta mata/limão já usada no app.
 */
export default function LogoMarca({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Costa Mello Agroconsultoria"
    >
      <path
        d="M29 13c1-5 5-8 11-9-2 5-5 8-10 10z"
        fill="#183628"
      />
      <circle cx="21" cy="27" r="16.5" fill="none" stroke="#183628" strokeWidth="5" />
      <circle cx="21" cy="27" r="12.5" fill="#eaf78d" />
      <g stroke="#225338" strokeWidth="1.6" strokeLinecap="round">
        <line x1="21" y1="16" x2="21" y2="38" />
        <line x1="10" y1="27" x2="32" y2="27" />
        <line x1="13.2" y1="19.2" x2="28.8" y2="34.8" />
        <line x1="13.2" y1="34.8" x2="28.8" y2="19.2" />
      </g>
      <circle cx="21" cy="27" r="7.5" fill="none" stroke="#225338" strokeWidth="1.3" opacity="0.55" />
      <circle cx="21" cy="27" r="3" fill="#a8bd10" />
    </svg>
  );
}
