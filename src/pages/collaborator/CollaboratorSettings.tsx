import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KeyRound, Save, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import ChangePasswordDialog from '@/components/franchise/ChangePasswordDialog';


const CollaboratorSettings = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('CPF');

  const { data: profile } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('username').eq('id', user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: beneficiary, isLoading } = useQuery({
    queryKey: ['my-beneficiary', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_beneficiaries')
        .select('id, name, type, pix_key, pix_key_type')
        .eq('user_id', user!.id)
        .eq('type', 'seller')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (beneficiary) {
      setPixKey(beneficiary.pix_key || '');
      setPixKeyType(beneficiary.pix_key_type || 'CPF');
    }
  }, [beneficiary]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('commission_beneficiaries')
        .update({ pix_key: pixKey.trim() || null, pix_key_type: pixKeyType } as any)
        .eq('id', beneficiary!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-beneficiary', user?.id] });
      toast.success('Chave PIX salva com sucesso!');
    },
    onError: (err: any) => toast.error('Erro ao salvar: ' + err.message),
  });

  const typeLabel: Record<string, string> = {
    seller: 'Vendedor',
    presenter: 'Apresentador',
    supervisor: 'Supervisor',
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Gerencie sua chave PIX e senha de acesso</p>
      </div>

      {profile?.username && (
        <div className="flex items-center gap-3">
          <ChangePasswordDialog username={profile.username} />
        </div>
      )}

      {beneficiary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Chave PIX para Recebimento
            </CardTitle>
            <CardDescription>
              Esta chave será utilizada para transferência das suas comissões.
              Cadastrado como: <strong>{beneficiary.name}</strong> · {typeLabel[beneficiary.type] || beneficiary.type}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {beneficiary.pix_key && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 text-sm font-medium">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span>Chave PIX cadastrada: <strong>{beneficiary.pix_key_type}</strong> · {beneficiary.pix_key}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label>Tipo de Chave PIX</Label>
              <Select value={pixKeyType} onValueChange={setPixKeyType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CPF">CPF</SelectItem>
                  <SelectItem value="CNPJ">CNPJ</SelectItem>
                  <SelectItem value="EMAIL">E-mail</SelectItem>
                  <SelectItem value="PHONE">Telefone</SelectItem>
                  <SelectItem value="EVP">Chave Aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Chave PIX</Label>
              <Input
                value={pixKey}
                onChange={e => setPixKey(e.target.value)}
                placeholder="Digite sua chave PIX"
              />
            </div>

            <Button
              className="w-full"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? 'Salvando...' : 'Salvar Chave PIX'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CollaboratorSettings;
