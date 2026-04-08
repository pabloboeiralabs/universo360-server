import { 
  LayoutDashboard, 
  Building2, 
  DollarSign,
  GraduationCap,
  Calendar,
  Users,
  Settings,
  FileText,
  ShoppingCart,
  UserCheck,
  CreditCard,
  Mail,
  ShieldAlert,
} from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import SidebarHeader from './sidebar/SidebarHeader';
import SidebarSection from './sidebar/SidebarSection';
import SidebarMenuItem from './sidebar/SidebarMenuItem';
import SidebarAccordion from './sidebar/SidebarAccordion';
import ThemeToggle from './sidebar/ThemeToggle';
import SidebarFooter from './sidebar/SidebarFooter';

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  embedded?: boolean;
}

const AdminSidebar = ({ collapsed, onToggle, embedded = false }: AdminSidebarProps) => {
  return (
    <TooltipProvider delayDuration={0}>
      <aside 
        className={cn(
          "h-screen bg-sidebar flex flex-col transition-all duration-300 z-40 overflow-visible",
          embedded ? "w-full relative" : "fixed left-0 top-0",
          !embedded && (collapsed ? "w-[72px]" : "w-[280px]")
        )}
      >
        {/* Header with Logo and Toggle */}
        <SidebarHeader 
          collapsed={collapsed} 
          onToggle={onToggle}
          title="MATRIZ"
          subtitle="Admin Master"
        />

        {/* Navigation Menu */}
        <nav className={cn(
          "flex-1 overflow-x-visible",
          collapsed ? "overflow-y-hidden" : "overflow-y-auto"
        )}>
          {/* Gestão Global Section */}
          <SidebarSection label="Gestão Global" collapsed={collapsed}>
            <SidebarMenuItem
              title="Dashboard"
              icon={LayoutDashboard}
              path="/admin"
              collapsed={collapsed}
              end
            />
            <SidebarAccordion
              title="Franquias"
              icon={Building2}
              collapsed={collapsed}
              children={[
                { title: 'Listar', path: '/admin/franquias' },
              ]}
            />
            <SidebarMenuItem
              title="Comissões"
              icon={DollarSign}
              path="/admin/comissoes"
              collapsed={collapsed}
            />
          </SidebarSection>

          {/* Meu Planetário Section */}
          <SidebarSection label="Meu Planetário" collapsed={collapsed}>
            <SidebarMenuItem
              title="Clientes"
              icon={Users}
              path="/admin/escolas"
              collapsed={collapsed}
            />
            <SidebarMenuItem
              title="Meus Eventos"
              icon={Calendar}
              path="/admin/eventos"
              collapsed={collapsed}
            />
            <SidebarMenuItem
              title="Extrato"
              icon={FileText}
              path="/admin/extrato"
              collapsed={collapsed}
            />
            <SidebarMenuItem
              title="Vendas"
              icon={ShoppingCart}
              path="/admin/vendas-matriz"
              collapsed={collapsed}
            />
            <SidebarMenuItem
              title="Pagamentos"
              icon={CreditCard}
              path="/admin/pagamentos-matriz"
              collapsed={collapsed}
            />
            <SidebarMenuItem
              title="Comissionados"
              icon={UserCheck}
              path="/admin/beneficiarios"
              collapsed={collapsed}
            />
            <SidebarMenuItem
              title="E-mails Enviados"
              icon={Mail}
              path="/admin/emails"
              collapsed={collapsed}
            />
            <SidebarMenuItem
              title="Configurações"
              icon={Settings}
              path="/admin/configuracoes"
              collapsed={collapsed}
            />
            <SidebarMenuItem
              title="Credenciais"
              icon={ShieldAlert}
              path="/admin/credenciais"
              collapsed={collapsed}
            />
          </SidebarSection>
        </nav>

        {/* Footer with Theme Toggle and User Profile */}
        <div className="mt-auto">
          <ThemeToggle collapsed={collapsed} />
          <SidebarFooter collapsed={collapsed} />
        </div>
      </aside>
    </TooltipProvider>
  );
};

export default AdminSidebar;
