import BeneficiariesManagement from '@/components/franchise/BeneficiariesManagement';
import { useFranchiseContext } from './FranchiseLayout';

const FranchiseBeneficiariesPage = () => {
  const { franchise } = useFranchiseContext();
  if (!franchise) return null;
  return <BeneficiariesManagement franchiseId={franchise.id} />;
};

export default FranchiseBeneficiariesPage;
