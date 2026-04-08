import { useFranchiseContext } from './FranchiseLayout';
import FranchisePayoutsReport from '@/components/franchise/FranchisePayoutsReport';

const FranchisePayoutsPage = () => {
  const { franchise } = useFranchiseContext();

  if (!franchise) {
    return null;
  }

  return <FranchisePayoutsReport franchiseId={franchise.id} />;
};

export default FranchisePayoutsPage;
