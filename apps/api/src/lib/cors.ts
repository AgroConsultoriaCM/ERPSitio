// Quem pode chamar a API a partir de um navegador.
//
// Com o frontend na Vercel e a API na Oracle, site e API passam a viver em
// origens diferentes, e o navegador só entrega a resposta se a API disser
// explicitamente que aquela origem é bem-vinda.

type Decisao = (erro: Error | null, permitido: boolean) => void;
type Verificacao = true | ((origem: string | undefined, decidir: Decisao) => void);

/** Tira a barra final para "https://sitio.com.br/" casar com "https://sitio.com.br". */
function normalizar(origem: string) {
  return origem.trim().replace(/\/+$/, "");
}

export function montarVerificacaoOrigem(
  configurado: string,
  aoRecusar?: (origem: string) => void,
): Verificacao {
  const bruto = configurado.trim();

  // "*" existe para o desenvolvimento local. Em produção o .env traz a lista.
  if (bruto === "*") return true;

  const permitidas = new Set(
    bruto.split(",").map(normalizar).filter((o) => o.length > 0),
  );

  return (origem, decidir) => {
    // Sem cabeçalho Origin não é requisição de navegador: é curl, health check
    // do Docker ou serviço chamando serviço. CORS não protege esse caso (e nem
    // deveria bloqueá-lo) — quem protege ali é o token.
    if (!origem) return decidir(null, true);

    if (permitidas.has(normalizar(origem))) return decidir(null, true);

    // Recusa silenciosa: sem o cabeçalho, o próprio navegador barra. Devolver
    // erro aqui viraria 500 no log e esconderia a causa real.
    aoRecusar?.(origem);
    decidir(null, false);
  };
}
