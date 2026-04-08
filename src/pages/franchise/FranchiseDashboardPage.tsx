import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFranchiseContext } from './FranchiseLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import KPICard from '@/components/admin/KPICard';
import { CreditCard, Calendar, Users, Settings, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const gatewayLabels: Record<string, string> = {
  asaas: 'ASAAS',
  pagbank: 'PagBank',
  mercadopago: 'Mercado Pago',
};

const FranchiseDashboardPage = () => {
  const { franchise } = useFranchiseContext();
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['franchise-dashboard-stats', franchise?.id],
    queryFn: async () => {
      const [eventsRes, customersRes] = await Promise.all([
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('franchise_id', franchise!.id).eq('is_active', true),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('franchise_id', franchise!.id).eq('is_active', true),
      ]);
      return {
        totalEvents: eventsRes.count ?? 0,
        totalCustomers: customersRes.count ?? 0,
      };
    },
    enabled: !!franchise?.id,
  });

  if (!franchise) return null;

  const gateway = franchise.payment_gateway || 'asaas';
  const hasCredentials =
    (gateway === 'asaas' && !!franchise.asaas_api_key) ||
    (gateway === 'pagbank' && !!franchise.pagbank_token) ||
    (gateway === 'mercadopago' && !!franchise.mercadopago_access_token);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gateway Card */}
        <Card className="md:col-span-1 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Gateway de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-foreground">{gatewayLabels[gateway] ?? gateway}</span>
              <Badge
                variant={hasCredentials ? 'default' : 'secondary'}
                className={hasCredentials ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/20'}
              >
                {hasCredentials ? (
                  <><CheckCircle className="h-3 w-3 mr-1" /> Conectado</>
                ) : (
                  <><AlertCircle className="h-3 w-3 mr-1" /> Pendente</>
                )}
              </Badge>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/franchise/configuracoes')}>
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </Button>
          </CardContent>
        </Card>

        {/* KPIs */}
        <KPICard
          title="Eventos Ativos"
          value={stats?.totalEvents ?? 0}
          icon={Calendar}
          variant="default"
        />
        <KPICard
          title="Clientes"
          value={stats?.totalCustomers ?? 0}
          icon={Users}
          variant="default"
        />
      </div>
    </div>
  );
};

export default FranchiseDashboardPage;
