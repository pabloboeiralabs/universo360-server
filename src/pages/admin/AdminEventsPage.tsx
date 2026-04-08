import { Loader2 } from 'lucide-react';
import { useAdminContext } from '@/components/admin/AdminLayout';
import EventManagement from '@/components/franchise/EventManagement';

const AdminEventsPage = () => {
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
        <h1 className="text-lg md:text-3xl font-bold">Meus Eventos</h1>
        <p className="text-xs md:text-sm text-muted-foreground">Gerencie os eventos do seu planetário</p>
      </div>
      <EventManagement franchiseId={adminFranchiseId} />
    </div>
  );
};

export default AdminEventsPage;
