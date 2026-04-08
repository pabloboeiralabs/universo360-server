import { 
  Calendar,
  Users,
  FileText,
  Settings,
  Home,
  CreditCard,
  UserCheck,
  ShoppingCart
} from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import SidebarHeader from '@/components/admin/sidebar/SidebarHeader';
import SidebarSection from '@/components/admin/sidebar/SidebarSection';
import SidebarMenuItem from '@/components/admin/sidebar/SidebarMenuItem';
import ThemeToggle from '@/components/admin/sidebar/ThemeToggle';
import FranchiseSidebarFooter from './FranchiseSidebarFooter';

interface FranchiseSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  franchiseName?: string;
  embedded?: boolean;
}

const FranchiseSidebar = ({ collapsed, onToggle, franchiseName, embedded = false }: FranchiseSidebarProps) => {
  return (
    <TooltipProvider delayDuration={0}>
      <aside 
        className={cn(
          "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 z-40",
          embedded ? "w-full relative" : "fixed left-0 top-0",
          !embedded && (collapsed ? "w-[72px]" : "w-[280px]")
        )}
      >
        {/* Header with Logo and Toggle */}
        <div className={cn(
          "flex items-center h-16 px-4 border-b border-sidebar-border",
          collapsed ? "justify-center" : "justify-between"
        )}>
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">U</span>
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sidebar-foreground text-sm leading-tight">
                  {franchiseName || 'Franquia'}
                </span>
                <span className="text-xs text-sidebar-foreground/50">Universo360</span>
              </div>
            </div>
          )}
          
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">U</span>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Meu Planetário Section */}
          <SidebarSection label="Meu Planetário" collapsed={collapsed}>
            <SidebarMenuItem
              title="Dashboard"
              icon={Home}
              path="/franchise"
              collapsed={collapsed}
              end
            />
            <SidebarMenuItem
              title="Clientes"
              icon={Users}
              path="/franchise/clientes"
              collapsed={collapsed}
            />
            <SidebarMenuItem
              title="Eventos"
              icon={Calendar}
              path="/franchise/eventos"
              collapsed={collapsed}
            />
            <SidebarMenuItem
              title="Extrato"
              icon={FileText}
              path="/franchise/extrato"
              collapsed={collapsed}
            />
            <SidebarMenuItem
              title="Vendas"
              icon={ShoppingCart}
              path="/franchise/vendas"
              collapsed={collapsed}
            />
            <SidebarMenuItem
              title="Pagamentos"
              icon={CreditCard}
              path="/franchise/pagamentos"
              collapsed={collapsed}
            />
            <SidebarMenuItem
              title="Comissionados"
              icon={UserCheck}
              path="/franchise/beneficiarios"
              collapsed={collapsed}
            />
            <SidebarMenuItem
              title="Configurações"
              icon={Settings}
              path="/franchise/configuracoes"
              collapsed={collapsed}
            />
          </SidebarSection>

          {/* Quick Links Section */}
          <SidebarSection label="Atalhos" collapsed={collapsed}>
            <SidebarMenuItem
              title="Voltar ao Site"
              icon={Home}
              path="/"
              collapsed={collapsed}
            />
          </SidebarSection>
        </nav>

        {/* Footer with Theme Toggle and User Profile */}
        <div className="mt-auto">
          <ThemeToggle collapsed={collapsed} />
          <FranchiseSidebarFooter collapsed={collapsed} />
        </div>
      </aside>
    </TooltipProvider>
  );
};

export default FranchiseSidebar;
