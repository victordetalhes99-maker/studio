import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import "./styles.css";

// Reset único: limpa cadastros e status para deixar o sistema zerado
const RESET_FLAG = "ink_studio_reset_v2";
if (typeof window !== "undefined" && !localStorage.getItem(RESET_FLAG)) {
  localStorage.removeItem("ink_studio_clientes_v1");
  localStorage.removeItem("ink_studio_status_v1");
  localStorage.setItem(RESET_FLAG, new Date().toISOString());
}

import { AuthProvider } from "@/lib/auth/AuthProvider";
const RequireAdmin = lazy(() => import("./lib/auth/RequireAdmin"));

const CheckinPage = lazy(() => import("./routes/index"));
const CadastroPage = lazy(() => import("./routes/cadastro.$cpf"));
const RecorrentePage = lazy(() => import("./routes/recorrente.$cpf"));
const LgpdPage = lazy(() => import("./routes/lgpd-solicitacao"));
const NotFound = lazy(() => import("./routes/not-found"));
const AdminLoginPage = lazy(() => import("./routes/admin-login"));
const ForgotPasswordPage = lazy(() => import("./routes/forgot-password"));
const ResetPasswordPage = lazy(() => import("./routes/reset-password"));
const AcessoNegadoPage = lazy(() => import("./routes/acesso-negado"));

// Painel administrativo (nova arquitetura)
const AdminLayout = lazy(() => import("./components/admin/layout/AdminLayout"));
const AdminDashboard = lazy(() => import("./routes/admin/index"));
const AdminTatuadores = lazy(() => import("./routes/admin/tatuadores"));
const AdminClientes = lazy(() => import("./routes/admin/clientes"));
const AdminClienteDetalhe = lazy(() => import("./routes/admin/clientes.$cpf"));
const AdminCheckins = lazy(() => import("./routes/admin/checkins"));
const AdminCheckinDetalhe = lazy(() => import("./routes/admin/checkins.$id"));
const AdminFichas = lazy(() => import("./routes/admin/fichas"));
const AdminFichaDetalhe = lazy(() => import("./routes/admin/fichas.$id"));
const AdminContratos = lazy(() => import("./routes/admin/contratos"));
const AdminContratoDetalhe = lazy(() => import("./routes/admin/contratos.$id"));
const AdminDocumentos = lazy(() => import("./routes/admin/documentos"));
const AdminDocumentoDetalhe = lazy(() => import("./routes/admin/documentos.$id"));
const AdminRisco = lazy(() => import("./routes/admin/risco"));
const AdminClientesRisco = lazy(() => import("./routes/admin/clientes-risco"));
const AdminClientesRiscoDetalhe = lazy(() => import("./routes/admin/clientes-risco.$id"));
const AdminRelatoriosLayout = lazy(() => import("./routes/admin/relatorios/layout"));
const AdminRelatoriosIndex = lazy(() => import("./routes/admin/relatorios/index"));
const AdminRelatoriosAtendimentos = lazy(() => import("./routes/admin/relatorios/atendimentos"));
const AdminRelatoriosClientes = lazy(() => import("./routes/admin/relatorios/clientes"));
const AdminRelatoriosTatuadores = lazy(() => import("./routes/admin/relatorios/tatuadores"));
const AdminRelatoriosTatuadorDetalhe = lazy(
  () => import("./routes/admin/relatorios/tatuadores.$id"),
);
const AdminRelatoriosContratos = lazy(() => import("./routes/admin/relatorios/contratos"));
const AdminRelatoriosFichas = lazy(() => import("./routes/admin/relatorios/fichas"));
const AdminRelatoriosRisco = lazy(() => import("./routes/admin/relatorios/clientes-risco"));
const AdminRelatoriosDocumentos = lazy(() => import("./routes/admin/relatorios/documentos"));
const AdminRelatoriosCheckIns = lazy(() => import("./routes/admin/relatorios/check-ins"));
const AdminBackupLayout = lazy(() => import("./components/admin/backup/BackupLayout"));
const AdminBackupOverview = lazy(() => import("./routes/admin/backup/index"));
const AdminBackupDestinos = lazy(() => import("./routes/admin/backup/destinos"));
const AdminBackupPolitica = lazy(() => import("./routes/admin/backup/politica"));
const AdminBackupHistorico = lazy(() => import("./routes/admin/backup/historico"));
const AdminBackupDetalhe = lazy(() => import("./routes/admin/backup/historico.$id"));
const AdminBackupIntegridade = lazy(() => import("./routes/admin/backup/integridade"));
const AdminBackupExportacao = lazy(() => import("./routes/admin/backup/exportacao"));
const AdminBackupRestauracao = lazy(() => import("./routes/admin/backup/restauracao"));
const AdminBackupAlertas = lazy(() => import("./routes/admin/backup/alertas"));
const AdminBackupDiagnostico = lazy(() => import("./routes/admin/backup/diagnostico"));
const ConfigLayout = lazy(() => import("./routes/admin/configuracoes/layout"));
const ConfigGeral = lazy(() => import("./routes/admin/configuracoes/geral"));
const ConfigIdentidade = lazy(() => import("./routes/admin/configuracoes/identidade"));
const ConfigAdministrador = lazy(() => import("./routes/admin/configuracoes/administrador"));
const ConfigSeguranca = lazy(() => import("./routes/admin/configuracoes/seguranca"));
const ConfigOperacao = lazy(() => import("./routes/admin/configuracoes/operacao"));
const ConfigDocumentos = lazy(() => import("./routes/admin/configuracoes/documentos"));
const ConfigBackup = lazy(() => import("./routes/admin/configuracoes/backup"));
const ConfigIntegracoes = lazy(() => import("./routes/admin/configuracoes/integracoes"));
const ConfigSistema = lazy(() => import("./routes/admin/configuracoes/sistema"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
});

const Fallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="h-8 w-8 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
  </div>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<Fallback />}>
            <Routes>
              <Route path="/" element={<CheckinPage />} />
              <Route path="/cadastro" element={<CadastroPage />} />
              <Route path="/recorrente" element={<RecorrentePage />} />
              <Route path="/lgpd" element={<LgpdPage />} />
              <Route path="/admin-login" element={<AdminLoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/acesso-negado" element={<AcessoNegadoPage />} />

              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="tatuadores" element={<AdminTatuadores />} />
                  <Route path="clientes" element={<AdminClientes />} />
                  <Route path="clientes/:cpf" element={<AdminClienteDetalhe />} />
                  <Route path="checkins" element={<AdminCheckins />} />
                  <Route path="checkins/:id" element={<AdminCheckinDetalhe />} />
                  <Route path="fichas" element={<AdminFichas />} />
                  <Route path="fichas/:id" element={<AdminFichaDetalhe />} />
                  <Route path="contratos" element={<AdminContratos />} />
                  <Route path="contratos/:id" element={<AdminContratoDetalhe />} />
                  <Route path="documentos" element={<AdminDocumentos />} />
                  <Route path="documentos/:id" element={<AdminDocumentoDetalhe />} />
                  <Route path="risco" element={<AdminRisco />} />
                  <Route path="clientes-risco" element={<AdminClientesRisco />} />
                  <Route path="clientes-risco/:id" element={<AdminClientesRiscoDetalhe />} />
                  <Route path="relatorios" element={<AdminRelatoriosLayout />}>
                    <Route index element={<AdminRelatoriosIndex />} />
                    <Route path="atendimentos" element={<AdminRelatoriosAtendimentos />} />
                    <Route path="clientes" element={<AdminRelatoriosClientes />} />
                    <Route path="tatuadores" element={<AdminRelatoriosTatuadores />} />
                    <Route path="tatuadores/:id" element={<AdminRelatoriosTatuadorDetalhe />} />
                    <Route path="contratos" element={<AdminRelatoriosContratos />} />
                    <Route path="fichas" element={<AdminRelatoriosFichas />} />
                    <Route path="clientes-risco" element={<AdminRelatoriosRisco />} />
                    <Route path="documentos" element={<AdminRelatoriosDocumentos />} />
                    <Route path="check-ins" element={<AdminRelatoriosCheckIns />} />
                  </Route>
                  <Route path="backup" element={<AdminBackupLayout />}>
                    <Route index element={<AdminBackupOverview />} />
                    <Route path="destinos" element={<AdminBackupDestinos />} />
                    <Route path="politica" element={<AdminBackupPolitica />} />
                    <Route path="historico" element={<AdminBackupHistorico />} />
                    <Route path="historico/:id" element={<AdminBackupDetalhe />} />
                    <Route path="integridade" element={<AdminBackupIntegridade />} />
                    <Route path="exportacao" element={<AdminBackupExportacao />} />
                    <Route path="restauracao" element={<AdminBackupRestauracao />} />
                    <Route path="alertas" element={<AdminBackupAlertas />} />
                    <Route path="diagnostico" element={<AdminBackupDiagnostico />} />
                  </Route>
                  <Route path="configuracoes" element={<ConfigLayout />}>
                    <Route index element={<ConfigGeral />} />
                    <Route path="identidade" element={<ConfigIdentidade />} />
                    <Route path="administrador" element={<ConfigAdministrador />} />
                    <Route path="seguranca" element={<ConfigSeguranca />} />
                    <Route path="operacao" element={<ConfigOperacao />} />
                    <Route path="documentos" element={<ConfigDocumentos />} />
                    <Route path="backup" element={<ConfigBackup />} />
                    <Route path="integracoes" element={<ConfigIntegracoes />} />
                    <Route path="sistema" element={<ConfigSistema />} />
                  </Route>
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
        <Toaster theme="dark" position="top-right" richColors closeButton />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
