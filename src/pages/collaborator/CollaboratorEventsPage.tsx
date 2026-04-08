import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import EventManagement from '@/components/franchise/EventManagement';

const CollaboratorEventsPage = () => {
  const { user } = useAuth();

  const { data: beneficiary, isLoading } = useQuery({
    queryKey: ['my-beneficiary', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_beneficiaries')
        .select('id, franchise_id')
        .eq('user_id', user!.id)
        .eq('type', 'seller')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (isLoading || !beneficiary) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return <EventManagement franchiseId={beneficiary.franchise_id} sellerBeneficiaryId={beneficiary.id} />;
};

export default CollaboratorEventsPage;
