import { Outlet } from "react-router-dom";

/**
 * Layout do módulo de Relatórios.
 * Não adiciona chrome extra além do <Outlet />; o cabeçalho, filtros e
 * breadcrumb são renderizados por cada página filha para permitir variações
 * (ex.: página individual do tatuador). Mantém o namespace /admin/relatorios
 * separado, facilitando futura injeção de contexto.
 */
export default function RelatoriosLayout() {
  return <Outlet />;
}
