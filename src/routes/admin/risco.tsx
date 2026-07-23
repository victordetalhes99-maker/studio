import { Navigate } from "react-router-dom";

/**
 * Rota legada. Toda a lógica de Clientes de Risco vive em
 * `src/routes/admin/clientes-risco.tsx` e `src/lib/risk/`.
 */
export default function AdminRiscoLegacyRedirect() {
  return <Navigate to="/admin/clientes-risco" replace />;
}
