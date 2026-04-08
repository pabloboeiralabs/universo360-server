import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";

import AdminLogin from "./pages/AdminLogin";
import AdminLayout from "./components/admin/AdminLayout";
import { GlobalDashboard } from "./components/admin/GlobalDashboard";
import SalesReport from "./components/admin/SalesReport";
import CommissionsReport from "./components/admin/CommissionsReport";
import CommissionPayoutsReport from "./components/admin/CommissionPayoutsReport";
import FranchiseManagement from "./components/admin/FranchiseManagement";
import GradesManagement from "./components/admin/GradesManagement";
import AdminEventsPage from "./pages/admin/AdminEventsPage";
import AdminCustomersPage from "./pages/admin/AdminCustomersPage";
import CashFlow from "./components/admin/CashFlow";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import AdminBeneficiariesPage from "./pages/admin/AdminBeneficiariesPage";
import AdminSalesPage from "./pages/admin/AdminSalesPage";
import AdminPayoutsPage from "./pages/admin/AdminPayoutsPage";
import EmailLogs from "./components/admin/EmailLogs";
import AdminCredentialsPage from "./pages/admin/AdminCredentialsPage";

// Franchise Pages
import FranchiseLayout from "./pages/franchise/FranchiseLayout";
import FranchiseDashboardPage from "./pages/franchise/FranchiseDashboardPage";
import FranchiseCustomersPage from "./pages/franchise/FranchiseCustomersPage";
import FranchiseEventsPage from "./pages/franchise/FranchiseEventsPage";
import FranchiseStatementPage from "./pages/franchise/FranchiseStatementPage";
import FranchisePayoutsPage from "./pages/franchise/FranchisePayoutsPage";
import FranchiseSettingsPage from "./pages/franchise/FranchiseSettingsPage";
import FranchiseBeneficiariesPage from "./pages/franchise/FranchiseBeneficiariesPage";
import FranchiseSalesPage from "./pages/franchise/FranchiseSalesPage";

// Collaborator Pages
import CollaboratorLayout from "./pages/collaborator/CollaboratorLayout";
import CollaboratorDashboard from "./pages/collaborator/CollaboratorDashboard";
import CollaboratorSettings from "./pages/collaborator/CollaboratorSettings";
import CollaboratorCustomersPage from "./pages/collaborator/CollaboratorCustomersPage";
import CollaboratorEventsPage from "./pages/collaborator/CollaboratorEventsPage";
import CollaboratorChangePassword from "./pages/collaborator/CollaboratorChangePassword";

import BuyTicket from "./pages/BuyTicket";

import PaymentStatus from "./pages/PaymentStatus";
import InstallApp from "./pages/InstallApp";
import PublicStudentList from "./pages/PublicStudentList";
import AdminCredentialsFullPage from "./pages/AdminCredentialsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={
                <ProtectedRoute requiredRoles={['admin']} redirectTo="/admin/login">
                  <AdminLayout />
                </ProtectedRoute>
              }>
                {/* Global Management */}
                <Route index element={<GlobalDashboard />} />
                <Route path="franquias" element={<FranchiseManagement />} />
                <Route path="series" element={<GradesManagement />} />
                <Route path="vendas" element={<SalesReport />} />
                <Route path="comissoes" element={<CommissionsReport />} />
                <Route path="pagamentos" element={<CommissionPayoutsReport />} />
                {/* Admin's Own Planetarium */}
                <Route path="escolas" element={<AdminCustomersPage />} />
                <Route path="eventos" element={<AdminEventsPage />} />
                <Route path="extrato" element={<CashFlow />} />
                <Route path="vendas-matriz" element={<AdminSalesPage />} />
                <Route path="pagamentos-matriz" element={<AdminPayoutsPage />} />
                <Route path="beneficiarios" element={<AdminBeneficiariesPage />} />
                <Route path="emails" element={<EmailLogs />} />
                <Route path="configuracoes" element={<AdminSettingsPage />} />
                <Route path="credenciais" element={<AdminCredentialsPage />} />
              </Route>
              
              {/* Franchise Routes with Layout */}
              <Route path="/franchise" element={
                <ProtectedRoute requiredRoles={['franchise_owner']} redirectTo="/admin/login">
                  <FranchiseLayout />
                </ProtectedRoute>
              }>
                <Route index element={<FranchiseDashboardPage />} />
                <Route path="clientes" element={<FranchiseCustomersPage />} />
                <Route path="eventos" element={<FranchiseEventsPage />} />
                <Route path="extrato" element={<FranchiseStatementPage />} />
                <Route path="vendas" element={<FranchiseSalesPage />} />
                <Route path="pagamentos" element={<FranchisePayoutsPage />} />
                <Route path="beneficiarios" element={<FranchiseBeneficiariesPage />} />
                <Route path="configuracoes" element={<FranchiseSettingsPage />} />
              </Route>
              
              
              {/* Collaborator Routes */}
              <Route path="/colaborador/trocar-senha" element={
                <ProtectedRoute requiredRoles={['collaborator']} redirectTo="/admin/login">
                  <CollaboratorChangePassword />
                </ProtectedRoute>
              } />
              <Route path="/colaborador" element={
                <ProtectedRoute requiredRoles={['collaborator']} redirectTo="/admin/login">
                  <CollaboratorLayout />
                </ProtectedRoute>
              }>
              <Route index element={<CollaboratorDashboard />} />
                <Route path="escolas" element={<CollaboratorCustomersPage />} />
                <Route path="eventos" element={<CollaboratorEventsPage />} />
                <Route path="configuracoes" element={<CollaboratorSettings />} />
              </Route>

              <Route path="/comprar/:eventId" element={<BuyTicket />} />
              <Route path="/lista/:eventId" element={<PublicStudentList />} />
              <Route path="/payment-status" element={<PaymentStatus />} />
              <Route path="/admin-credentials" element={
                <ProtectedRoute requiredRoles={['admin']} redirectTo="/admin/login">
                  <AdminCredentialsFullPage />
                </ProtectedRoute>
              } />
              <Route path="/install" element={<InstallApp />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
