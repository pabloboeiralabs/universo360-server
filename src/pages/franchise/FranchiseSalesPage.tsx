import { useFranchiseContext } from '@/pages/franchise/FranchiseLayout';
import SalesReport from '@/components/admin/SalesReport';

const FranchiseSalesPage = () => {
  const { franchise } = useFranchiseContext();

  return <SalesReport franchiseId={franchise?.id} />;
};

export default FranchiseSalesPage;
