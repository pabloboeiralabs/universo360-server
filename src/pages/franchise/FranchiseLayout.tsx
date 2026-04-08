import { useState, createContext, useContext, useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import FranchiseSidebar from '@/components/franchise/FranchiseSidebar';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FranchiseContextType {
  franchise: any | null;
  isLoadingFranchise: boolean;
}

const FranchiseContext = createContext<FranchiseContextType>({
  franchise: null,
  isLoadingFranchise: true,
});

export const useFranchiseContext = () => useContext(FranchiseContext);

const FranchiseLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const { data: franchise, isLoading: isLoadingFranchise } = useQuery({
    queryKey: ['user-franchise', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('franchises')
        .select('*')
        .eq('owner_id', user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  if (isLoadingFranchise) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!franchise) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <p className="text-muted-foreground">Você não está associado a nenhuma franquia.</p>
          <p className="text-sm text-muted-foreground mt-2">Entre em contato com o administrador.</p>
        </div>
      </div>
    );
  }

  const franchiseLabel = `${franchise.name} - ${franchise.city}/${franchise.state}`;

  return (
    <FranchiseContext.Provider value={{ franchise, isLoadingFranchise }}>
      <div className="min-h-screen w-full bg-background">
        {isMobile ? (
          <>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetContent side="left" className="p-0 w-[280px]">
                <FranchiseSidebar 
                  collapsed={false} 
                  onToggle={() => setMobileOpen(false)}
                  franchiseName={franchiseLabel}
                  embedded
                />
              </SheetContent>
            </Sheet>
            <header className="sticky top-0 z-30 flex items-center h-14 px-4 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground">
                <Menu className="h-5 w-5" />
              </Button>
              <span className="ml-3 font-semibold text-sm truncate">{franchise.name}</span>
            </header>
          </>
        ) : (
          <FranchiseSidebar 
            collapsed={collapsed} 
            onToggle={() => setCollapsed(!collapsed)}
            franchiseName={franchiseLabel}
          />
        )}
        <main 
          className={cn(
            "min-h-screen overflow-x-hidden transition-all duration-300 bg-background max-w-full",
            isMobile ? "ml-0" : collapsed ? "ml-[72px]" : "ml-[280px]"
          )}
        >
          <div className="p-2 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </FranchiseContext.Provider>
  );
};

export default FranchiseLayout;
