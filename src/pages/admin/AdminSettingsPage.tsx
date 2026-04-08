import { useAdminContext } from '@/components/admin/AdminLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import PaymentGatewaySettings from '@/components/franchise/PaymentGatewaySettings';
import AccountSettings from '@/components/admin/AccountSettings';
import ImportHistory from '@/components/admin/ImportHistory';
import { Loader2 } from 'lucide-react';

const AdminSettingsPage = () => {
  const { adminFranchiseId, isLoadingFranchise } = useAdminContext();

  const { data: franchise, isLoading } = useQuery({
    queryKey: ['admin-franchise-settings', adminFranchiseId],
    queryFn: async () => {
      if (!adminFranchiseId) return null;
      
      const { data, error } = await supabase
        .from('franchises')
        .select('*')
        .eq('id', adminFranchiseId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!adminFranchiseId,
  });

  if (isLoadingFranchise || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!franchise) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Franquia não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl md:text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">Configure as integrações do seu planetário</p>
      </div>

      <AccountSettings />
      <PaymentGatewaySettings franchise={franchise} />
      <ImportHistory />
    </div>
  );
};

export default AdminSettingsPage;
