import FranchiseStatement from '@/components/franchise/FranchiseStatement';
import { useFranchiseContext } from './FranchiseLayout';

const FranchiseStatementPage = () => {
  const { franchise } = useFranchiseContext();

  if (!franchise) return null;

  return (
    <FranchiseStatement 
      franchiseId={franchise.id}
      commissionType={franchise.commission_type}
      commissionValue={franchise.commission_value}
    />
  );
};

export default FranchiseStatementPage;
