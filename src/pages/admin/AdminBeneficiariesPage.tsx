import { useAdminContext } from '@/components/admin/AdminLayout';
import BeneficiariesManagement from '@/components/franchise/BeneficiariesManagement';

const AdminBeneficiariesPage = () => {
  const { adminFranchiseId, isLoadingFranchise } = useAdminContext();

  if (isLoadingFranchise) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (!adminFranchiseId) {
    return <p className="text-muted-foreground p-4">Franquia não encontrada.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Comissionados</h1>
        <p className="text-muted-foreground">Gerencie vendedores, apresentadores e supervisores</p>
      </div>
      <BeneficiariesManagement franchiseId={adminFranchiseId} />
    </div>
  );
};

export default AdminBeneficiariesPage;
