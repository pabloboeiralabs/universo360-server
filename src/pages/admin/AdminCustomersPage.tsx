import { Loader2 } from 'lucide-react';
import { useAdminContext } from '@/components/admin/AdminLayout';
import CustomersManagement from '@/components/admin/CustomersManagement';

const AdminCustomersPage = () => {
  const { adminFranchiseId, isLoadingFranchise } = useAdminContext();

  if (isLoadingFranchise) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!adminFranchiseId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Erro ao carregar dados da franquia. Tente recarregar a página.
      </div>
    );
  }

  return (
    <div className="p-2 md:p-8">
      <div className="mb-6">
        <h1 className="text-lg md:text-3xl font-bold">Minhas Escolas</h1>
        <p className="text-xs md:text-sm text-muted-foreground">Gerencie as escolas parceiras da Matriz</p>
      </div>
      <CustomersManagement franchiseId={adminFranchiseId} />
    </div>
  );
};

export default AdminCustomersPage;
