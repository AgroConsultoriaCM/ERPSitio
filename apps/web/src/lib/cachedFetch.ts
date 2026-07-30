import { api } from "./api";

const PREFIX = "erpsitio_cache_";

// Busca uma lista da API e guarda uma copia em localStorage. Se a rede
// falhar (sitio sem sinal), usa a ultima copia salva para o formulario de
// apontamento continuar funcionavel offline.
export async function fetchComCache<T>(chave: string, path: string): Promise<T> {
  try {
    const dados = await api.get<T>(path);
    localStorage.setItem(PREFIX + chave, JSON.stringify(dados));
    return dados;
  } catch (err) {
    const cache = localStorage.getItem(PREFIX + chave);
    if (cache) return JSON.parse(cache) as T;
    throw err;
  }
}
