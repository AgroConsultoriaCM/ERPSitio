import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "./index.css";
import "./lib/leafletIconFix";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { iniciarSyncAutomatico } from "./offline/sync";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

iniciarSyncAutomatico();

// Nota: sem React.StrictMode de propósito. O double-invoke de efeitos do
// StrictMode em dev conflita com o controle imperativo do Leaflet Draw
// (chega a montar dois controles/handlers de desenho ao mesmo tempo,
// causando bugs como o poligono "travar" depois de poucos vertices).
ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </QueryClientProvider>,
);
