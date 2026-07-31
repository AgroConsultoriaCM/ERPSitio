/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta com nome da operacao, nao do tom: quem le o codigo entende
        // para que serve. "mata" e a cor da marca; as outras sao semanticas e
        // se repetem em toda tela que fala do mesmo assunto.
        mata: {
          50: "#f0f7f2",
          100: "#dcecdf",
          200: "#bbd9c3",
          300: "#8fbf9e",
          400: "#5c9e74",
          500: "#3a8257",
          600: "#2a6844",
          700: "#225338",
          800: "#1d422e",
          900: "#183628",
        },
        // colheita: caixas, produtividade, receita
        limao: {
          50: "#fbfde8",
          100: "#f5fbc4",
          200: "#eaf78d",
          300: "#dbed4c",
          400: "#c9dd1c",
          500: "#a8bd10",
          600: "#82970b",
          700: "#62730d",
          800: "#4e5b12",
          900: "#424d14",
        },
        // agua: chuva, irrigacao, manejo hidrico
        agua: {
          50: "#eff8ff",
          100: "#dbeefe",
          200: "#bfe2fe",
          300: "#93d1fd",
          400: "#60b6fa",
          500: "#3b98f6",
          600: "#257aeb",
          700: "#1d63d8",
          800: "#1e51af",
          900: "#1e468a",
        },
        // terra: neutros quentes, para nao dar aspecto de planilha
        terra: {
          50: "#faf9f7",
          100: "#f3f1ed",
          200: "#e7e3db",
          300: "#d5cec2",
          400: "#b3a894",
          500: "#94886f",
          600: "#7a6f59",
          700: "#645b49",
          800: "#524b3e",
          900: "#454036",
        },
      },
      fontFamily: {
        // Pilha do sistema: carrega instantaneo e continua funcionando offline,
        // que e a condicao normal do celular no campo.
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        // Numero de caixa, area e dinheiro alinham melhor com largura fixa.
        num: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        // Sombras em camadas: uma rente ao objeto, que dá a borda, e outra
        // difusa, que dá a altura. Uma sombra só sempre parece adesivo colado.
        cartao:
          "0 1px 2px -1px rgb(24 54 40 / 0.08), 0 1px 3px 0 rgb(24 54 40 / 0.05), 0 0 0 1px rgb(24 54 40 / 0.03)",
        "cartao-alto":
          "0 2px 4px -2px rgb(24 54 40 / 0.10), 0 8px 20px -4px rgb(24 54 40 / 0.12), 0 0 0 1px rgb(24 54 40 / 0.04)",
        interno: "inset 0 1px 2px 0 rgb(24 54 40 / 0.06)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      transitionTimingFunction: {
        // Sai rápido, chega devagar: parece coisa física freando, não
        // interpolação linear de software.
        suave: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "surgir-de-baixo": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        surgir: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        // Usado no ponto de "sem conexão" e em alerta que precisa ser notado
        // sem piscar na cara de quem está trabalhando.
        pulsar: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        // Faixa de carregamento (esqueleto) atravessando o bloco cinza.
        brilho: {
          "100%": { transform: "translateX(100%)" },
        },
        crescer: {
          from: { transform: "scaleY(0)" },
          to: { transform: "scaleY(1)" },
        },
      },
      animation: {
        "surgir-de-baixo": "surgir-de-baixo 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        surgir: "surgir 0.35s ease-out both",
        pulsar: "pulsar 2s ease-in-out infinite",
        brilho: "brilho 1.6s infinite",
        crescer: "crescer 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};
