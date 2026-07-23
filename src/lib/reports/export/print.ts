/**
 * Aciona a impressão nativa do navegador com CSS @media print
 * já registrado globalmente. Esconde sidebar/header/controles
 * e imprime apenas o conteúdo marcado com data-print-area.
 */
export function printReport(): void {
  document.body.classList.add("printing-report");
  const cleanup = () => {
    document.body.classList.remove("printing-report");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  // pequeno atraso para permitir aplicar a classe antes do diálogo
  setTimeout(() => window.print(), 50);
}
