import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ExcelImportExport from '@/components/shared/ExcelImportExport';
import { ColumnDef } from '@/lib/excelUtils';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Search, Eye, EyeOff, User, KeyRound, Link2, CheckCircle, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Franchise {
  id: string;
  name: string;
  city: string;
  state: string;
  owner_id: string | null;
  is_active: boolean;
  mercadopago_access_token: string | null;
  mercadopago_public_key: string | null;
  mercadopago_refresh_token: string | null;
  mercadopago_user_id: number | null;
  commission_type: string | null;
  commission_value: number | null;
  created_at: string;
}

interface FranchiseForm {
  name: string;
  city: string;
  state: string;
  username: string;
  password: string;
  full_name: string;
  mercadopago_access_token: string;
  mercadopago_public_key: string;
  commission_type: 'fixed' | 'percentage';
  commission_value: string;
}

interface ResetPasswordState {
  franchiseId: string;
  franchiseName: string;
  username: string;
}

interface OAuthManualState {
  franchise: Franchise;
  step: 'url' | 'code' | 'success';
  authUrl: string;
  code: string;
  isLoading: boolean;
  accountInfo?: {
    email?: string;
    nickname?: string;
  };
}

const franchiseExcelColumns: ColumnDef[] = [
  { key: 'id', header: 'ID', width: 36 },
  { key: 'name', header: 'Nome', width: 25, required: true },
  { key: 'city', header: 'Cidade', width: 18, required: true },
  { key: 'state', header: 'Estado', width: 5, required: true },
  { key: 'commission_type', header: 'Tipo Comissão', width: 15 },
  { key: 'commission_value', header: 'Valor Comissão', width: 15 },
  { key: 'payment_gateway', header: 'Gateway', width: 12 },
  { key: 'is_active', header: 'Ativo', width: 6, transform: (v: boolean) => v ? 'Sim' : 'Não', parse: (v: any) => String(v).toLowerCase() === 'sim' || v === true },
];

const FranchiseManagement = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingFranchise, setEditingFranchise] = useState<Franchise | null>(null);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showPublicKey, setShowPublicKey] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState<ResetPasswordState | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [oauthManual, setOauthManual] = useState<OAuthManualState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [form, setForm] = useState<FranchiseForm>({
    name: '',
    city: '',
    state: '',
    username: '',
    password: '',
    full_name: '',
    mercadopago_access_token: '',
    mercadopago_public_key: '',
    commission_type: 'fixed',
    commission_value: '2.00',
  });

  const { data: franchises, isLoading } = useQuery({
    queryKey: ['admin-franchises'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('franchises')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Franchise[];
    },
  });

  const createFranchise = useMutation({
    mutationFn: async (data: FranchiseForm) => {
      // Use Edge Function with service_role to create user and franchise atomically
      const { data: result, error } = await supabase.functions.invoke('create-franchise-user', {
        body: {
          username: data.username,
          password: data.password,
          full_name: data.full_name,
          franchise_name: data.name,
          city: data.city,
          state: data.state,
          mercadopago_access_token: data.mercadopago_access_token || null,
          mercadopago_public_key: data.mercadopago_public_key || null,
          commission_type: data.commission_type,
          commission_value: parseFloat(data.commission_value) || 2.00,
        },
      });

      if (error) {
        throw new Error(`Erro ao criar franquia: ${error.message}`);
      }

      if (result?.error) {
        throw new Error(result.error);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-franchises'] });
      setIsCreateOpen(false);
      resetForm();
      toast.success('Franquia criada com sucesso! Login configurado.');
    },
    onError: (error) => {
      toast.error('Erro ao criar franquia: ' + error.message);
    },
  });

  const updateFranchise = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FranchiseForm> }) => {
      const updateData: Record<string, unknown> = {
        name: data.name,
        city: data.city,
        state: data.state,
        commission_type: data.commission_type,
        commission_value: data.commission_value ? parseFloat(data.commission_value) : undefined,
      };

      if (data.mercadopago_access_token) {
        updateData.mercadopago_access_token = data.mercadopago_access_token;
      }
      if (data.mercadopago_public_key) {
        updateData.mercadopago_public_key = data.mercadopago_public_key;
      }

      const { error } = await supabase
        .from('franchises')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-franchises'] });
      setEditingFranchise(null);
      resetForm();
      toast.success('Franquia atualizada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar franquia: ' + error.message);
    },
  });

  const deleteFranchise = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('franchises')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-franchises'] });
      toast.success('Franquia excluída com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir franquia: ' + error.message);
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('franchises')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-franchises'] });
      toast.success('Status atualizado!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar status: ' + error.message);
    },
  });

  const resetForm = () => {
    setForm({
      name: '',
      city: '',
      state: '',
      username: '',
      password: '',
      full_name: '',
      mercadopago_access_token: '',
      mercadopago_public_key: '',
      commission_type: 'fixed',
      commission_value: '2.00',
    });
    setShowAccessToken(false);
    setShowPublicKey(false);
    setShowPassword(false);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordOpen) return;

    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setIsResettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-admin-password', {
        body: {
          username: resetPasswordOpen.username,
          newPassword: newPassword,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Senha da franquia "${resetPasswordOpen.franchiseName}" atualizada com sucesso!`);
      setResetPasswordOpen(null);
      setNewPassword('');
      setConfirmPassword('');
      setShowNewPassword(false);
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Erro ao resetar senha: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setIsResettingPassword(false);
    }
  };

  const openResetPassword = async (franchise: Franchise) => {
    // Fetch the username from profiles using owner_id
    if (!franchise.owner_id) {
      toast.error('Franquia não possui usuário vinculado');
      return;
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', franchise.owner_id)
      .single();

    if (error || !profile?.username) {
      toast.error('Não foi possível encontrar o usuário da franquia');
      return;
    }

    setResetPasswordOpen({
      franchiseId: franchise.id,
      franchiseName: franchise.name,
      username: profile.username,
    });
  };

  const openOAuthManual = async (franchise: Franchise) => {
    setOauthManual({
      franchise,
      step: 'url',
      authUrl: '',
      code: '',
      isLoading: true,
    });

    try {
      const { data, error } = await supabase.functions.invoke('mp-oauth-manual', {
        body: {
          action: 'get_auth_url',
          franchise_id: franchise.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setOauthManual(prev => prev ? {
        ...prev,
        authUrl: data.auth_url,
        isLoading: false,
      } : null);
    } catch (error) {
      console.error('Error getting auth URL:', error);
      toast.error('Erro ao gerar URL de autorização: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
      setOauthManual(null);
    }
  };

  const handleExchangeCode = async () => {
    if (!oauthManual || !oauthManual.code) {
      toast.error('Por favor, cole o código de autorização');
      return;
    }

    setOauthManual(prev => prev ? { ...prev, isLoading: true } : null);

    try {
      const { data, error } = await supabase.functions.invoke('mp-oauth-manual', {
        body: {
          action: 'exchange_code',
          franchise_id: oauthManual.franchise.id,
          code: oauthManual.code.trim(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setOauthManual(prev => prev ? {
        ...prev,
        step: 'success',
        isLoading: false,
        accountInfo: data.account_info,
      } : null);

      queryClient.invalidateQueries({ queryKey: ['admin-franchises'] });
      toast.success('OAuth configurado com sucesso!');
    } catch (error) {
      console.error('Error exchanging code:', error);
      toast.error('Erro ao processar código: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
      setOauthManual(prev => prev ? { ...prev, isLoading: false } : null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência!');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingFranchise) {
      updateFranchise.mutate({
        id: editingFranchise.id,
        data: form,
      });
    } else {
      if (!form.username || !form.password) {
        toast.error('Usuário e senha são obrigatórios');
        return;
      }
      if (form.password.length < 6) {
        toast.error('A senha deve ter pelo menos 6 caracteres');
        return;
      }
      createFranchise.mutate(form);
    }
  };

  const openEdit = (franchise: Franchise) => {
    setEditingFranchise(franchise);
    setForm({
      name: franchise.name,
      city: franchise.city,
      state: franchise.state,
      username: '',
      password: '',
      full_name: '',
      mercadopago_access_token: '',
      mercadopago_public_key: '',
      commission_type: (franchise.commission_type as 'fixed' | 'percentage') || 'fixed',
      commission_value: franchise.commission_value?.toString() || '2.00',
    });
  };

  const filteredFranchises = franchises?.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.city.toLowerCase().includes(search.toLowerCase()) ||
      f.state.toLowerCase().includes(search.toLowerCase())
  );

  const createFormFieldsJSX = (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome da Franquia</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Cidade</Label>
          <Input
            id="city"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="state">Estado</Label>
        <Input
          id="state"
          value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value })}
          required
        />
      </div>

      {/* Login Credentials */}
      <div className="border-t pt-4 mt-4">
        <h4 className="font-medium mb-4 flex items-center gap-2">
          <User className="h-4 w-4" />
          Credenciais de Acesso
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="username">Usuário</Label>
            <Input
              id="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '_') })}
              placeholder="nome_franquia"
              required
            />
            <p className="text-xs text-muted-foreground">Sem espaços, apenas letras e números</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Mínimo 6 caracteres</p>
          </div>
        </div>
        <div className="space-y-2 mt-4">
          <Label htmlFor="full_name">Nome do Responsável</Label>
          <Input
            id="full_name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="Nome completo do responsável"
          />
        </div>
      </div>

      {/* Commission Settings */}
      <div className="border-t pt-4 mt-4">
        <h4 className="font-medium mb-4">Configuração de Comissão</h4>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Comissão</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="commission_type"
                  value="fixed"
                  checked={form.commission_type === 'fixed'}
                  onChange={(e) => setForm({ ...form, commission_type: e.target.value as 'fixed' | 'percentage' })}
                  className="w-4 h-4 text-primary"
                />
                <span>Valor Fixo (R$)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="commission_type"
                  value="percentage"
                  checked={form.commission_type === 'percentage'}
                  onChange={(e) => setForm({ ...form, commission_type: e.target.value as 'fixed' | 'percentage' })}
                  className="w-4 h-4 text-primary"
                />
                <span>Percentual (%)</span>
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="commission_value">
              Valor da Comissão {form.commission_type === 'fixed' ? '(R$)' : '(%)'}
            </Label>
            <Input
              id="commission_value"
              type="number"
              step="0.01"
              min="0"
              value={form.commission_value}
              onChange={(e) => setForm({ ...form, commission_value: e.target.value })}
              placeholder={form.commission_type === 'fixed' ? '2.00' : '10'}
            />
            <p className="text-xs text-muted-foreground">
              {form.commission_type === 'fixed'
                ? `A matriz receberá R$ ${form.commission_value || '0'} por ingresso vendido`
                : `A matriz receberá ${form.commission_value || '0'}% sobre cada venda`}
            </p>
          </div>
        </div>
      </div>

      {/* Mercado Pago Settings */}
      <div className="border-t pt-4 mt-4">
        <h4 className="font-medium mb-4">Credenciais Mercado Pago</h4>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accessToken">Access Token</Label>
            <div className="relative">
              <Input
                id="accessToken"
                type={showAccessToken ? 'text' : 'password'}
                value={form.mercadopago_access_token}
                onChange={(e) => setForm({ ...form, mercadopago_access_token: e.target.value })}
                placeholder="APP_USR-..."
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowAccessToken(!showAccessToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showAccessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="publicKey">Public Key</Label>
            <div className="relative">
              <Input
                id="publicKey"
                type={showPublicKey ? 'text' : 'password'}
                value={form.mercadopago_public_key}
                onChange={(e) => setForm({ ...form, mercadopago_public_key: e.target.value })}
                placeholder="APP_USR-..."
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPublicKey(!showPublicKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPublicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const editFormFieldsJSX = (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome da Franquia</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Cidade</Label>
          <Input
            id="city"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="state">Estado</Label>
        <Input
          id="state"
          value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value })}
          required
        />
      </div>

      {/* Commission Settings */}
      <div className="border-t pt-4 mt-4">
        <h4 className="font-medium mb-4">Configuração de Comissão</h4>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Comissão</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="edit_commission_type"
                  value="fixed"
                  checked={form.commission_type === 'fixed'}
                  onChange={(e) => setForm({ ...form, commission_type: e.target.value as 'fixed' | 'percentage' })}
                  className="w-4 h-4 text-primary"
                />
                <span>Valor Fixo (R$)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="edit_commission_type"
                  value="percentage"
                  checked={form.commission_type === 'percentage'}
                  onChange={(e) => setForm({ ...form, commission_type: e.target.value as 'fixed' | 'percentage' })}
                  className="w-4 h-4 text-primary"
                />
                <span>Percentual (%)</span>
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_commission_value">
              Valor da Comissão {form.commission_type === 'fixed' ? '(R$)' : '(%)'}
            </Label>
            <Input
              id="edit_commission_value"
              type="number"
              step="0.01"
              min="0"
              value={form.commission_value}
              onChange={(e) => setForm({ ...form, commission_value: e.target.value })}
              placeholder={form.commission_type === 'fixed' ? '2.00' : '10'}
            />
            <p className="text-xs text-muted-foreground">
              {form.commission_type === 'fixed'
                ? `A matriz receberá R$ ${form.commission_value || '0'} por ingresso vendido`
                : `A matriz receberá ${form.commission_value || '0'}% sobre cada venda`}
            </p>
          </div>
        </div>
      </div>

      {/* Mercado Pago Settings */}
      <div className="border-t pt-4 mt-4">
        <h4 className="font-medium mb-4">Credenciais Mercado Pago</h4>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accessToken">Access Token</Label>
            <div className="relative">
              <Input
                id="accessToken"
                type={showAccessToken ? 'text' : 'password'}
                value={form.mercadopago_access_token}
                onChange={(e) => setForm({ ...form, mercadopago_access_token: e.target.value })}
                placeholder={editingFranchise?.mercadopago_access_token ? '••••••••' : 'APP_USR-...'}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowAccessToken(!showAccessToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showAccessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="publicKey">Public Key</Label>
            <div className="relative">
              <Input
                id="publicKey"
                type={showPublicKey ? 'text' : 'password'}
                value={form.mercadopago_public_key}
                onChange={(e) => setForm({ ...form, mercadopago_public_key: e.target.value })}
                placeholder={editingFranchise?.mercadopago_public_key ? '••••••••' : 'APP_USR-...'}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPublicKey(!showPublicKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPublicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <CardTitle className="text-lg md:text-2xl">Gerenciamento de Franquias</CardTitle>
        <div className="flex items-center gap-2">
          <ExcelImportExport
            data={franchises || []}
            columns={franchiseExcelColumns}
            entityName="franquias"
            onImport={async (rows) => {
              for (const row of rows) {
                const payload = {
                  name: row.name || '',
                  city: row.city || '',
                  state: row.state || '',
                  commission_type: row.commission_type || 'fixed',
                  commission_value: parseFloat(row.commission_value) || 2,
                  is_active: row.is_active !== undefined ? row.is_active : true,
                };
                if (row.id && row.id !== '(não preencher para novo)') {
                  await supabase.from('franchises').update(payload).eq('id', row.id);
                }
              }
              queryClient.invalidateQueries({ queryKey: ['admin-franchises'] });
            }}
          />
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setEditingFranchise(null); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Franquia
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Nova Franquia</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {createFormFieldsJSX}
              <Button type="submit" className="w-full" disabled={createFranchise.isPending}>
                {createFranchise.isPending ? 'Criando...' : 'Criar Franquia'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar franquias..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                   <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Localização</TableHead>
                  <TableHead className="hidden md:table-cell">Mercado Pago</TableHead>
                  
                  <TableHead>Ativa</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFranchises?.map((franchise) => (
                  <TableRow key={franchise.id}>
                    <TableCell className="font-medium text-xs md:text-sm">{franchise.name}</TableCell>
                    <TableCell className="hidden md:table-cell">{franchise.city}/{franchise.state}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {franchise.mercadopago_access_token ? (
                        <Badge className="bg-green-500/20 text-green-500">Configurado</Badge>
                      ) : (
                        <Badge variant="secondary">Não configurado</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={franchise.is_active}
                        onCheckedChange={(checked) =>
                          toggleActive.mutate({ id: franchise.id, isActive: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openResetPassword(franchise)}
                          title="Resetar senha"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Dialog 
                          open={editingFranchise?.id === franchise.id} 
                          onOpenChange={(open) => !open && setEditingFranchise(null)}
                        >
                          <DialogTrigger asChild>
                            <Button variant="outline" size="icon" onClick={() => openEdit(franchise)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Editar Franquia</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                              {editFormFieldsJSX}
                              <Button type="submit" className="w-full" disabled={updateFranchise.isPending}>
                                {updateFranchise.isPending ? 'Salvando...' : 'Salvar Alterações'}
                              </Button>
                            </form>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setDeleteTarget(franchise.id);
                            setDeletePassword('');
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Reset Password Dialog */}
        <Dialog 
          open={!!resetPasswordOpen} 
          onOpenChange={(open) => {
            if (!open) {
              setResetPasswordOpen(null);
              setNewPassword('');
              setConfirmPassword('');
              setShowNewPassword(false);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Resetar Senha
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Resetar senha da franquia: <strong>{resetPasswordOpen?.franchiseName}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Usuário: <strong>{resetPasswordOpen?.username}</strong>
              </p>
              
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Mínimo 6 caracteres</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <Input
                  id="confirmPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setResetPasswordOpen(null);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleResetPassword}
                  disabled={isResettingPassword || !newPassword || !confirmPassword}
                >
                  {isResettingPassword ? 'Salvando...' : 'Resetar Senha'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeletePassword(''); } }}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Confirmar Exclusão</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Digite a senha de administrador para confirmar a exclusão da franquia.
              </p>
              <div className="space-y-2">
                <Label htmlFor="deletePassword">Senha</Label>
                <Input
                  id="deletePassword"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="••••••••"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && deleteTarget && deletePassword) {
                      if (deletePassword === '@Pdlb2709') {
                        deleteFranchise.mutate(deleteTarget);
                        setDeleteTarget(null);
                        setDeletePassword('');
                      } else {
                        toast.error('Senha incorreta');
                      }
                    }
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setDeleteTarget(null); setDeletePassword(''); }}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={!deletePassword}
                  onClick={() => {
                    if (deletePassword === '@Pdlb2709') {
                      deleteFranchise.mutate(deleteTarget!);
                      setDeleteTarget(null);
                      setDeletePassword('');
                    } else {
                      toast.error('Senha incorreta');
                    }
                  }}
                >
                  Excluir
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog 
          open={!!oauthManual} 
          onOpenChange={(open) => {
            if (!open) {
              setOauthManual(null);
            }
          }}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Configurar OAuth Mercado Pago
              </DialogTitle>
            </DialogHeader>
            
            {oauthManual?.isLoading && oauthManual.step === 'url' ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : oauthManual?.step === 'success' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-4">
                  <div className="rounded-full bg-green-500/20 p-4">
                    <CheckCircle className="h-12 w-12 text-green-500" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="font-semibold text-lg">OAuth Configurado com Sucesso!</h3>
                  <p className="text-muted-foreground">
                    A franquia <strong>{oauthManual.franchise.name}</strong> agora está conectada ao Mercado Pago.
                  </p>
                  {oauthManual.accountInfo && (
                    <div className="bg-muted rounded-lg p-4 mt-4 text-sm">
                      <p><strong>Conta:</strong> {oauthManual.accountInfo.nickname || 'N/A'}</p>
                      <p><strong>Email:</strong> {oauthManual.accountInfo.email || 'N/A'}</p>
                    </div>
                  )}
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => setOauthManual(null)}
                >
                  Fechar
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Configurando OAuth para: <strong>{oauthManual?.franchise.name}</strong>
                </p>

                {/* Step 1: URL */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</div>
                    <h4 className="font-medium">Abrir URL de Autorização</h4>
                  </div>
                  <p className="text-sm text-muted-foreground ml-8">
                    Clique no botão abaixo para abrir a página de autorização do Mercado Pago. 
                    Faça login com a conta da <strong>franquia</strong> e autorize o aplicativo.
                  </p>
                  <div className="ml-8 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => oauthManual?.authUrl && copyToClipboard(oauthManual.authUrl)}
                      disabled={!oauthManual?.authUrl}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar URL
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => oauthManual?.authUrl && window.open(oauthManual.authUrl, '_blank')}
                      disabled={!oauthManual?.authUrl}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir Autorização
                    </Button>
                  </div>
                </div>

                {/* Step 2: Code */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</div>
                    <h4 className="font-medium">Colar o Código</h4>
                  </div>
                  <p className="text-sm text-muted-foreground ml-8">
                    Após autorizar, você será redirecionado para uma página. Copie o parâmetro <code className="bg-muted px-1 rounded">code</code> da URL e cole abaixo.
                  </p>
                  <p className="text-xs text-muted-foreground ml-8 italic">
                    Exemplo: ...callback?<strong>code=TG-abc123...</strong>&state=...
                  </p>
                  <div className="ml-8">
                    <Input
                      value={oauthManual?.code || ''}
                      onChange={(e) => setOauthManual(prev => prev ? { ...prev, code: e.target.value } : null)}
                      placeholder="TG-xxxxxxxx-xxxxxxxx-xxxxxxxx..."
                    />
                  </div>
                </div>

                {/* Step 3: Process */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">3</div>
                    <h4 className="font-medium">Processar Autorização</h4>
                  </div>
                  <div className="ml-8 flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setOauthManual(null)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleExchangeCode}
                      disabled={!oauthManual?.code || oauthManual?.isLoading}
                    >
                      {oauthManual?.isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        'Processar Código'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default FranchiseManagement;
