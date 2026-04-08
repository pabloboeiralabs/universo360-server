import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Settings, LogOut, Rocket, Menu, School, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';
import SidebarMenuItem from '@/components/admin/sidebar/SidebarMenuItem';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const navItems = [
  { to: '/colaborador', label: 'Meus Repasses', icon: LayoutDashboard, end: true },
  { to: '/colaborador/escolas', label: 'Minhas Escolas', icon: School },
  { to: '/colaborador/eventos', label: 'Meus Eventos', icon: Calendar },
  { to: '/colaborador/configuracoes', label: 'Configurações', icon: Settings },
];

const CollaboratorSidebar = ({ collapsed = false, onLogout }: { collapsed?: boolean; onLogout: () => void }) => (
  <TooltipProvider delayDuration={0}>
    <aside className={cn(
      "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
      collapsed ? "w-[72px]" : "w-[280px]"
    )}>
      <div className={cn(
        "flex items-center h-16 px-4 border-b border-sidebar-border",
        collapsed ? "justify-center" : "justify-start gap-3"
      )}>
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Rocket className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-semibold text-sidebar-foreground text-sm leading-tight">Universo 360</span>
            <span className="text-xs text-sidebar-foreground/50">Painel do Colaborador</span>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1">
        {navItems.map(({ to, label, icon, end }) => (
          <SidebarMenuItem
            key={to}
            title={label}
            icon={icon}
            path={to}
            collapsed={collapsed}
            end={end}
          />
        ))}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className={cn(
            "w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            collapsed ? "justify-center px-0" : "justify-start gap-3"
          )}
          onClick={onLogout}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="text-sm">Sair</span>}
        </Button>
      </div>
    </aside>
  </TooltipProvider>
);

const CollaboratorLayout = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Check if user must change password
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['my-profile-must-change', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('must_change_password').eq('id', user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!profileLoading && profile?.must_change_password) {
      navigate('/colaborador/trocar-senha', { replace: true });
    }
  }, [profile, profileLoading, navigate]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen w-full bg-background">
      {isMobile ? (
        <>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="p-0 w-[280px]">
              <CollaboratorSidebar onLogout={handleLogout} />
            </SheetContent>
          </Sheet>
          <header className="sticky top-0 z-30 flex items-center h-14 px-4 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground">
              <Menu className="h-5 w-5" />
            </Button>
            <span className="ml-3 font-semibold text-sm">Painel do Colaborador</span>
          </header>
        </>
      ) : (
        <div className="fixed left-0 top-0 z-40">
          <CollaboratorSidebar onLogout={handleLogout} />
        </div>
      )}

      <main className={cn(
        "min-h-screen overflow-x-hidden transition-all duration-300 bg-background max-w-full",
        isMobile ? "ml-0" : "ml-[280px]"
      )}>
        <div className="p-2 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default CollaboratorLayout;
