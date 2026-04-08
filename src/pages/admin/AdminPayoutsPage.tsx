import { useAdminContext } from '@/components/admin/AdminLayout';
import CommissionPayoutsReport from '@/components/admin/CommissionPayoutsReport';

const AdminPayoutsPage = () => {
  const { adminFranchiseId, isLoadingFranchise } = useAdminContext();

  if (isLoadingFranchise) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <CommissionPayoutsReport franchiseId={adminFranchiseId} />;
};

export default AdminPayoutsPage;
