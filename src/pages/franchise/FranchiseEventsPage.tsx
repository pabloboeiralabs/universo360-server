import EventManagement from '@/components/franchise/EventManagement';
import { useFranchiseContext } from './FranchiseLayout';

const FranchiseEventsPage = () => {
  const { franchise } = useFranchiseContext();

  if (!franchise) return null;

  return <EventManagement franchiseId={franchise.id} />;
};

export default FranchiseEventsPage;
