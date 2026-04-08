import PaymentGatewaySettings from '@/components/franchise/PaymentGatewaySettings';
import AccountSettings from '@/components/admin/AccountSettings';
import { useFranchiseContext } from './FranchiseLayout';

const FranchiseSettingsPage = () => {
  const { franchise } = useFranchiseContext();

  if (!franchise) return null;

  return (
    <div className="p-2 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie sua conta e integrações</p>
      </div>
      <AccountSettings />
      <PaymentGatewaySettings franchise={franchise} />
    </div>
  );
};

export default FranchiseSettingsPage;
