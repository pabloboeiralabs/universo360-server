import CustomersManagement from '@/components/admin/CustomersManagement';
import { useFranchiseContext } from './FranchiseLayout';

const FranchiseCustomersPage = () => {
  const { franchise } = useFranchiseContext();

  if (!franchise) return null;

  return <CustomersManagement franchiseId={franchise.id} />;
};

export default FranchiseCustomersPage;
