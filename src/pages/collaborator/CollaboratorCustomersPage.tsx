import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import CustomersManagement from '@/components/admin/CustomersManagement';
import { Loader2 } from 'lucide-react';

const CollaboratorCustomersPage = () => {
  const { user } = useAuth();
  const [franchiseId, setFranchiseId] = useState<string | null>(null);
  const [beneficiaryId, setBeneficiaryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBeneficiary = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('commission_beneficiaries')
        .select('id, franchise_id')
        .eq('user_id', user.id)
        .eq('type', 'seller')
        .limit(1)
        .maybeSingle();

      if (data) {
        setFranchiseId(data.franchise_id);
        setBeneficiaryId(data.id);
      }
      setIsLoading(false);
    };
    fetchBeneficiary();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!franchiseId || !beneficiaryId) {
    return (
      <div className="text-center text-muted-foreground py-16">
        Nenhum beneficiário vinculado a este usuário.
      </div>
    );
  }

  return (
    <CustomersManagement
      franchiseId={franchiseId}
      sellerBeneficiaryId={beneficiaryId}
    />
  );
};

export default CollaboratorCustomersPage;
