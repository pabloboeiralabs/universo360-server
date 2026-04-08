import { useState, createContext, useContext, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AdminSidebar from './AdminSidebar';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminContextType {
  adminFranchiseId: string | null;
  isLoadingFranchise: boolean;
}

const AdminContext = createContext<AdminContextType>({
  adminFranchiseId: null,
  isLoadingFranchise: true,
});

export const useAdminContext = () => useContext(AdminContext);

const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const location = useLocation();

  // Close mobile sheet on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const { data: adminFranchiseId, isLoading: isLoadingFranchise } = useQuery({
    queryKey: ['admin-franchise', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Check if admin already has a franchise
      const { data: existingFranchise, error: fetchError } = await supabase
        .from('franchises')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching admin franchise:', fetchError);
        return null;
      }

      if (existingFranchise) {
        return existingFranchise.id;
      }

      // Create a new "Matriz" franchise for the admin
      const { data: newFranchise, error: createError } = await supabase
        .from('franchises')
        .insert({
          name: 'Matriz',
          city: 'São Paulo',
          state: 'SP',
          owner_id: user.id,
          is_active: true,
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Error creating admin franchise:', createError);
        return null;
      }

      return newFranchise.id;
    },
    enabled: !!user?.id,
  });

  return (
    <AdminContext.Provider value={{ adminFranchiseId, isLoadingFranchise }}>
      <div className="min-h-screen w-full bg-background">
        {isMobile ? (
          <>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetContent side="left" className="p-0 w-[280px]">
                <AdminSidebar collapsed={false} onToggle={() => setMobileOpen(false)} embedded />
              </SheetContent>
            </Sheet>
            <header className="sticky top-0 z-30 flex items-center h-14 px-4 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground">
                <Menu className="h-5 w-5" />
              </Button>
              <span className="ml-3 font-semibold text-sm">MATRIZ</span>
            </header>
          </>
        ) : (
          <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
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
    </AdminContext.Provider>
  );
};

export default AdminLayout;
