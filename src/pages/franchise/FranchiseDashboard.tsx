import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, LogOut, Home, Users, FileText, Settings, CheckCircle, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import EventManagement from '@/components/franchise/EventManagement';
import CustomersManagement from '@/components/admin/CustomersManagement';
import FranchiseStatement from '@/components/franchise/FranchiseStatement';
import ChangePasswordDialog from '@/components/franchise/ChangePasswordDialog';
import AsaasSettings from '@/components/franchise/AsaasSettings';

const FranchiseDashboard = () => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('customers');

  const { data: franchise } = useQuery({
    queryKey: ['user-franchise', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('franchises')
        .select('*')
        .eq('owner_id', user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, full_name')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const handleSignOut = async () => {
    await signOut();
  };

  const isPGConnected = !!(franchise as any)?.asaas_api_key;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-primary hover:text-primary/80 transition-colors">
              <Home className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">Painel da Franquia</h1>
              {franchise && (
                <p className="text-sm text-muted-foreground">{franchise.name} - {franchise.city}/{franchise.state}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {franchise && (
              isPGConnected ? (
                <Badge variant="outline" className="border-green-500/50 text-green-600 bg-green-500/10 gap-1">
                  <CheckCircle className="h-3 w-3" />
                  <span className="hidden sm:inline">ASAAS Conectado</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="border-yellow-500/50 text-yellow-600 bg-yellow-500/10 gap-1">
                  <AlertCircle className="h-3 w-3" />
                  <span className="hidden sm:inline">ASAAS Pendente</span>
                </Badge>
              )
            )}
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {profile?.full_name || profile?.username || user?.email}
            </span>
            <ChangePasswordDialog username={profile?.username} />
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!franchise ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Você não está associado a nenhuma franquia.</p>
            <p className="text-sm text-muted-foreground mt-2">Entre em contato com o administrador.</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full max-w-xl grid-cols-4">
              <TabsTrigger value="customers" className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Clientes
              </TabsTrigger>
              <TabsTrigger value="events" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Eventos
              </TabsTrigger>
              <TabsTrigger value="statement" className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> Extrato
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" /> Configurações
              </TabsTrigger>
            </TabsList>

            <TabsContent value="customers">
              <CustomersManagement franchiseId={franchise.id} />
            </TabsContent>
            <TabsContent value="events">
              <EventManagement franchiseId={franchise.id} />
            </TabsContent>
            <TabsContent value="statement">
              <FranchiseStatement 
                franchiseId={franchise.id}
                commissionType={franchise.commission_type}
                commissionValue={franchise.commission_value}
              />
            </TabsContent>
            <TabsContent value="settings">
              <AsaasSettings franchise={franchise} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default FranchiseDashboard;
