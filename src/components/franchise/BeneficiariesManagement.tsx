import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Search, UserPlus, Eye, EyeOff, Trash2, Key, Mail, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import CommissionSummary from '@/components/franchise/CommissionSummary';
import ChangePasswordDialog from '@/components/franchise/ChangePasswordDialog';
import CommissionDefaultsSettings from '@/components/franchise/CommissionDefaultsSettings';
import ExcelImportExport from '@/components/shared/ExcelImportExport';
import { ColumnDef } from '@/lib/excelUtils';

const validatePhone = (v: any) => {
  if (!v || String(v).trim() === '') return null;
  const digits = String(v).replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11 ? null : 'Telefone inválido (10 ou 11 dígitos)';
};

const beneficiaryExcelColumns: ColumnDef[] = [
  { key: 'id', header: 'ID', width: 36 },
  { key: 'name', header: 'Nome', width: 25, required: true },
  { key: 'type', header: 'Tipo', width: 15, required: true },
  { key: 'pix_key', header: 'Chave PIX', width: 20 },
  { key: 'pix_key_type', header: 'Tipo PIX', width: 10 },
  { key: 'whatsapp', header: 'WhatsApp', width: 16, validate: validatePhone },
  { key: 'is_active', header: 'Ativo', width: 6, transform: (v: boolean) => v ? 'Sim' : 'Não', parse: (v: any) => String(v).toLowerCase() === 'sim' || v === true },
];

interface BeneficiariesManagementProps {
  franchiseId: string;
}

interface Beneficiary {
  id: string;
  franchise_id: string;
  name: string;
  type: string;
  is_active: boolean;
  created_at: string;
  pix_key?: string | null;
  pix_key_type?: string | null;
  user_id?: string | null;
  whatsapp?: string | null;
}

const typeLabels: Record<string, string> = {
  seller: 'Vendedor',
  presenter: 'Apresentador',
  supervisor: 'Supervisor',
};

const BeneficiariesManagement = ({ franchiseId }: BeneficiariesManagementProps) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('seller');
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Beneficiary | null>(null);
  const [formName, setFormName] = useState('');
  const [formPixKey, setFormPixKey] = useState('');
  const [formPixKeyType, setFormPixKeyType] = useState('CPF');
  const [formWhatsapp, setFormWhatsapp] = useState('');

  // Inline access creation in the new form
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);

  // Change password state (for beneficiaries with access)
  const [changePasswordBeneficiary, setChangePasswordBeneficiary] = useState<Beneficiary | null>(null);
  const [changePasswordUsername, setChangePasswordUsername] = useState<string | null>(null);

  const openChangePassword = async (b: Beneficiary) => {
    if (!b.user_id) return;
    const { data } = await supabase.from('profiles').select('username').eq('id', b.user_id).maybeSingle();
    setChangePasswordUsername(data?.username ?? null);
    setChangePasswordBeneficiary(b);
  };

  // View dialog state
  const [viewBeneficiary, setViewBeneficiary] = useState<Beneficiary | null>(null);
  const [viewUsername, setViewUsername] = useState<string | null>(null);

  const openView = async (b: Beneficiary) => {
    setViewUsername(null);
    setViewBeneficiary(b);
    if (b.user_id) {
      const { data } = await supabase.from('profiles').select('username').eq('id', b.user_id).maybeSingle();
      setViewUsername(data?.username ?? null);
    }
  };

  // Send credentials via WhatsApp
  const [credsBeneficiary, setCredsBeneficiary] = useState<Beneficiary | null>(null);
  const [credsUsername, setCredsUsername] = useState<string>('');
  const [credsWhatsapp, setCredsWhatsapp] = useState<string>('');
  const [credsPassword, setCredsPassword] = useState<string>('');
  const [showCredsPassword, setShowCredsPassword] = useState(false);

  const openSendCreds = async (b: Beneficiary) => {
    if (!b.user_id) return;
    const { data } = await supabase.from('profiles').select('username').eq('id', b.user_id).maybeSingle();
    setCredsUsername(data?.username ?? '');
    setCredsWhatsapp(b.whatsapp ?? '');
    setCredsPassword('123456');
    setShowCredsPassword(false);
    setCredsBeneficiary(b);
  };

  const handleSendCredsWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credsWhatsapp.trim() || !credsPassword.trim() || !credsBeneficiary) return;

    // 1. Atualizar a senha real no sistema
    const { data, error } = await supabase.functions.invoke('update-admin-password', {
      body: { username: credsUsername, newPassword: credsPassword },
    });
    if (error || data?.error) {
      toast.error('Erro ao atualizar senha: ' + (data?.error || error?.message));
      return;
    }

    // 2. Abrir WhatsApp com as credenciais
    const phone = credsWhatsapp.replace(/\D/g, '');
    const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;
    const loginUrl = `${window.location.origin}/admin/login`;
    const message =
      `Olá ${credsBeneficiary.name}! 👋\n\n` +
      `Aqui estão suas credenciais de acesso ao painel:\n\n` +
      `🔗 Link: ${loginUrl}\n` +
      `👤 Usuário: ${credsUsername}\n` +
      `🔑 Senha: ${credsPassword}\n\n` +
      `Guarde essas informações em local seguro.`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank');
    toast.success('Senha atualizada e WhatsApp aberto!');
    setCredsBeneficiary(null);
  };

  // Edit username state
  const [editUsername, setEditUsername] = useState<string>('');

  // Access creation state (for existing beneficiaries)
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const [accessBeneficiary, setAccessBeneficiary] = useState<Beneficiary | null>(null);
  const [accessUsername, setAccessUsername] = useState('');
  const [accessPassword, setAccessPassword] = useState('');
  const [showAccessPassword, setShowAccessPassword] = useState(false);
  const [isCreatingAccess, setIsCreatingAccess] = useState(false);

  useRealtimeSubscription('commission_beneficiaries', [['beneficiaries', franchiseId]], {
    column: 'franchise_id',
    value: franchiseId,
  });

  const { data: beneficiaries, isLoading } = useQuery({
    queryKey: ['beneficiaries', franchiseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_beneficiaries')
        .select('*')
        .eq('franchise_id', franchiseId)
        .order('name');
      if (error) throw error;
      return data as Beneficiary[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, name, type, pix_key, pix_key_type, whatsapp }: { id?: string; name: string; type: string; pix_key?: string; pix_key_type?: string; whatsapp?: string }) => {
      if (id) {
        const { error } = await supabase
          .from('commission_beneficiaries')
          .update({ name, pix_key: pix_key || null, pix_key_type: pix_key_type || null, whatsapp: whatsapp || null } as any)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('commission_beneficiaries')
          .insert({ franchise_id: franchiseId, name, type, pix_key: pix_key || null, pix_key_type: pix_key_type || null, whatsapp: whatsapp || null } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiaries', franchiseId] });
      setIsDialogOpen(false);
      setEditingItem(null);
      setFormName('');
      toast.success('Beneficiário salvo com sucesso!');
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('commission_beneficiaries')
        .update({ is_active } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiaries', franchiseId] });
      toast.success('Status atualizado!');
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });

  const filtered = beneficiaries
    ?.filter(b => b.type === activeTab)
    .filter(b => !search || b.name.toLowerCase().includes(search.toLowerCase())) || [];

  const [deleteTarget, setDeleteTarget] = useState<Beneficiary | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Clear FK references in events before deleting
      await supabase.from('events').update({ seller_id: null } as any).eq('seller_id', id);
      await supabase.from('events').update({ presenter_id: null } as any).eq('presenter_id', id);
      await supabase.from('events').update({ supervisor_id: null } as any).eq('supervisor_id', id);
      const { error } = await supabase.from('commission_beneficiaries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiaries', franchiseId] });
      toast.success('Comissionado excluído!');
      setDeleteTarget(null);
    },
    onError: (err: any) => toast.error('Erro ao excluir: ' + err.message),
  });

  const toUsername = (name: string) =>
    name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');

  const openCreate = () => {
    setEditingItem(null);
    setFormName('');
    setFormPixKey('');
    setFormPixKeyType('CPF');
    setFormWhatsapp('');
    setFormUsername('');
    setFormPassword('');
    setShowFormPassword(false);
    setIsDialogOpen(true);
  };

  const openEdit = async (b: Beneficiary) => {
    setEditingItem(b);
    setFormName(b.name);
    setFormPixKey(b.pix_key || '');
    setFormPixKeyType(b.pix_key_type || 'CPF');
    setFormWhatsapp(b.whatsapp || '');
    setFormUsername('');
    setFormPassword('');
    setShowFormPassword(false);
    setEditUsername('');
    if (b.user_id) {
      const { data } = await supabase.from('profiles').select('username').eq('id', b.user_id).maybeSingle();
      setEditUsername(data?.username ?? '');
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || isFormSubmitting) return;

    // If creating new with access credentials
    if (!editingItem && formUsername.trim() && formPassword.trim()) {
      setIsFormSubmitting(true);
      try {
        const { data: newBeneficiary, error: insertError } = await supabase
          .from('commission_beneficiaries')
          .insert({ franchise_id: franchiseId, name: formName.trim(), type: activeTab, pix_key: formPixKey.trim() || null, pix_key_type: formPixKeyType, whatsapp: formWhatsapp.trim() || null } as any)
          .select('id')
          .single();
        if (insertError) throw insertError;

        const { data, error: fnError } = await supabase.functions.invoke('create-collaborator', {
          body: { username: formUsername.trim(), password: formPassword.trim(), beneficiary_id: newBeneficiary.id },
        });

        // Rollback: delete orphaned beneficiary if edge function failed
        if (fnError || data?.error) {
          await supabase.from('commission_beneficiaries').delete().eq('id', newBeneficiary.id);
          throw new Error(data?.error || fnError?.message);
        }
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        queryClient.invalidateQueries({ queryKey: ['beneficiaries', franchiseId] });
        setIsDialogOpen(false);
        setEditingItem(null);
        setFormName('');
        toast.success(`Comissionado criado! Usuário: ${formUsername.trim()}`);
      } catch (err: any) {
        toast.error('Erro: ' + err.message);
      } finally {
        setIsFormSubmitting(false);
      }
      return;
    }

    // If editing without user_id but username+password provided → create access first via save
    if (editingItem && !editingItem.user_id && editUsername.trim() && formPassword.trim()) {
      setIsFormSubmitting(true);
      try {
        // Save basic info first
        const { error: saveErr } = await supabase
          .from('commission_beneficiaries')
          .update({ name: formName.trim(), pix_key: formPixKey.trim() || null, pix_key_type: formPixKeyType, whatsapp: formWhatsapp.trim() || null } as any)
          .eq('id', editingItem.id);
        if (saveErr) throw saveErr;

        const { data, error: fnError } = await supabase.functions.invoke('create-collaborator', {
          body: { username: editUsername.trim(), password: formPassword.trim(), beneficiary_id: editingItem.id },
        });
        if (fnError || data?.error) throw new Error(data?.error || fnError?.message);

        queryClient.invalidateQueries({ queryKey: ['beneficiaries', franchiseId] });
        setIsDialogOpen(false);
        setEditingItem(null);
        setFormName('');
        toast.success(`Acesso criado! Usuário: ${editUsername.trim()}`);
      } catch (err: any) {
        toast.error('Erro: ' + err.message);
      } finally {
        setIsFormSubmitting(false);
      }
      return;
    }

    // If editing and username changed, update profiles
    if (editingItem?.user_id && editUsername.trim()) {
      setIsFormSubmitting(true);
      try {
        const { error: profileErr } = await supabase
          .from('profiles')
          .update({ username: editUsername.trim() } as any)
          .eq('id', editingItem.user_id);
        if (profileErr) throw profileErr;
      } catch (err: any) {
        toast.error('Erro ao atualizar usuário: ' + err.message);
        setIsFormSubmitting(false);
        return;
      } finally {
        setIsFormSubmitting(false);
      }
    }

    saveMutation.mutate({ id: editingItem?.id, name: formName.trim(), type: activeTab, pix_key: formPixKey.trim() || undefined, pix_key_type: formPixKeyType, whatsapp: formWhatsapp.trim() || undefined });
  };

  const openCreateAccess = (b: Beneficiary) => {
    setAccessBeneficiary(b);
    // Pre-fill username suggestion from name
    setAccessUsername(b.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '.'));
    setAccessPassword('');
    setShowAccessPassword(false);
    setIsAccessDialogOpen(true);
  };

  const handleCreateAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessUsername.trim() || !accessPassword.trim() || !accessBeneficiary) return;
    setIsCreatingAccess(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-collaborator', {
        body: {
          username: accessUsername.trim(),
          password: accessPassword.trim(),
          beneficiary_id: accessBeneficiary.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ['beneficiaries', franchiseId] });
      setIsAccessDialogOpen(false);
      toast.success(`Acesso criado! Usuário: ${accessUsername.trim()}`);
    } catch (err: any) {
      toast.error('Erro ao criar acesso: ' + err.message);
    } finally {
      setIsCreatingAccess(false);
    }
  };

  return (
    <div className="space-y-6">
    <CommissionSummary franchiseId={franchiseId} />

    <Tabs defaultValue="comissionados">
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="comissionados">Comissionados</TabsTrigger>
        <TabsTrigger value="percentuais">Percentuais Padrão</TabsTrigger>
      </TabsList>

      <TabsContent value="percentuais">
        <CommissionDefaultsSettings franchiseId={franchiseId} />
      </TabsContent>

      <TabsContent value="comissionados">
    <Card>
      <CardHeader className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <CardTitle>Comissionados</CardTitle>
        <div className="flex items-center gap-2">
          <ExcelImportExport
            data={beneficiaries || []}
            columns={beneficiaryExcelColumns}
            entityName="comissionados"
            onImport={async (rows) => {
              for (const row of rows) {
                const payload = {
                  name: row.name || '',
                  type: row.type || activeTab,
                  pix_key: row.pix_key || null,
                  pix_key_type: row.pix_key_type || null,
                  whatsapp: row.whatsapp || null,
                  is_active: row.is_active !== undefined ? row.is_active : true,
                  franchise_id: franchiseId,
                };
                if (row.id && row.id !== '(não preencher para novo)') {
                  await supabase.from('commission_beneficiaries').update(payload as any).eq('id', row.id);
                } else {
                  await supabase.from('commission_beneficiaries').insert(payload as any);
                }
              }
              queryClient.invalidateQueries({ queryKey: ['beneficiaries', franchiseId] });
            }}
          />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo {typeLabels[activeTab]}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="seller">Vendedores</TabsTrigger>
            <TabsTrigger value="presenter">Apresentadores</TabsTrigger>
            <TabsTrigger value="supervisor">Supervisores</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-44 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(b => (
                 <TableRow key={b.id}>
                     <TableCell className="font-medium">
                       <div>
                         <p>{b.name}</p>
                         {b.pix_key && (
                           <p className="text-xs text-muted-foreground">PIX ({b.pix_key_type}): {b.pix_key}</p>
                         )}
                         {b.user_id ? (
                           <Badge variant="outline" className="text-xs mt-1 text-green-700 dark:text-green-400 border-green-400/50">Acesso ativo</Badge>
                         ) : (
                           <Badge variant="outline" className="text-xs mt-1 text-muted-foreground">Sem acesso</Badge>
                         )}
                       </div>
                     </TableCell>
                    <TableCell>
                      <Switch
                        checked={b.is_active}
                        onCheckedChange={checked => toggleActive.mutate({ id: b.id, is_active: checked })}
                      />
                    </TableCell>
                     <TableCell className="text-right">
                       <DropdownMenu>
                         <DropdownMenuTrigger asChild>
                           <Button variant="ghost" size="icon" className="h-8 w-8">
                             <MoreVertical className="h-4 w-4" />
                           </Button>
                         </DropdownMenuTrigger>
                         <DropdownMenuContent align="end">
                           <DropdownMenuItem onClick={() => openView(b)}>
                             <Eye className="h-4 w-4 mr-2" /> Visualizar
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => openEdit(b)}>
                             <Pencil className="h-4 w-4 mr-2" /> Editar
                           </DropdownMenuItem>
                           {!b.user_id && (
                             <DropdownMenuItem onClick={() => openCreateAccess(b)}>
                               <UserPlus className="h-4 w-4 mr-2" /> Criar acesso
                             </DropdownMenuItem>
                           )}
                           {b.user_id && (
                             <DropdownMenuItem onClick={() => openSendCreds(b)}>
                               <Mail className="h-4 w-4 mr-2" /> Enviar credenciais
                             </DropdownMenuItem>
                           )}
                           {b.user_id && (
                             <DropdownMenuItem onClick={() => openChangePassword(b)}>
                               <Key className="h-4 w-4 mr-2" /> Alterar senha
                             </DropdownMenuItem>
                           )}
                           <DropdownMenuSeparator />
                           <DropdownMenuItem
                             className="text-destructive focus:text-destructive"
                             onClick={() => setDeleteTarget(b)}
                           >
                             <Trash2 className="h-4 w-4 mr-2" /> Excluir
                           </DropdownMenuItem>
                         </DropdownMenuContent>
                       </DropdownMenu>
                     </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Nenhum {typeLabels[activeTab]?.toLowerCase()} cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Editar' : 'Novo'} {typeLabels[activeTab]}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="beneficiary_name">Nome</Label>
                <Input
                  id="beneficiary_name"
                  value={formName}
                  onChange={e => {
                    const n = e.target.value;
                    setFormName(n);
                    if (!editingItem) setFormUsername(toUsername(n));
                  }}
                  placeholder={`Nome do ${typeLabels[activeTab]?.toLowerCase()}`}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Chave PIX <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Select value={formPixKeyType} onValueChange={setFormPixKeyType}>
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
                <Label htmlFor="pix_key">Chave PIX <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input
                  id="pix_key"
                  value={formPixKey}
                  onChange={e => setFormPixKey(e.target.value)}
                  placeholder="Chave PIX para receber comissões"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="form_whatsapp">WhatsApp <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input
                  id="form_whatsapp"
                  type="tel"
                  value={formWhatsapp}
                  onChange={e => setFormWhatsapp(e.target.value)}
                  placeholder="(47) 99999-9999"
                />
              </div>

              {editingItem && (
                <div className="space-y-2 border-t pt-3">
                  <Label htmlFor="edit_username">
                    Usuário (login){!editingItem.user_id && <span className="text-muted-foreground font-normal text-xs ml-1">(opcional — cria acesso ao salvar)</span>}
                  </Label>
                  <Input
                    id="edit_username"
                    value={editUsername}
                    onChange={e => setEditUsername(e.target.value.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, ''))}
                    placeholder="ex: joao.silva"
                  />
                  <p className="text-xs text-muted-foreground">Somente letras minúsculas, números e pontos.</p>
                  {!editingItem.user_id && editUsername.trim() && (
                    <div className="space-y-2 pt-1">
                      <Label htmlFor="edit_new_password">Senha</Label>
                      <div className="relative">
                        <Input
                          id="edit_new_password"
                          type={showFormPassword ? 'text' : 'password'}
                          value={formPassword}
                          onChange={e => setFormPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          minLength={6}
                          required
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowFormPassword(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!editingItem && (
                <>
                  <div className="border-t pt-3">
                    <p className="text-sm font-medium mb-3">Acesso ao painel <span className="text-muted-foreground font-normal">(opcional)</span></p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="form_username">Usuário</Label>
                    <Input
                      id="form_username"
                      value={formUsername}
                      onChange={e => setFormUsername(e.target.value.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, ''))}
                      placeholder="ex: pablo.boeira"
                    />
                    <p className="text-xs text-muted-foreground">Somente letras minúsculas, números e pontos.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="form_password">Senha</Label>
                    <div className="relative">
                      <Input
                        id="form_password"
                        type={showFormPassword ? 'text' : 'password'}
                        value={formPassword}
                        onChange={e => setFormPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        minLength={formUsername.trim() ? 6 : undefined}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowFormPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <Button type="submit" className="w-full" disabled={saveMutation.isPending || isFormSubmitting}>
                {(saveMutation.isPending || isFormSubmitting) ? 'Salvando...' : 'Salvar'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* View Beneficiary Dialog */}
        <Dialog open={!!viewBeneficiary} onOpenChange={open => !open && setViewBeneficiary(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {viewBeneficiary?.name} ({typeLabels[viewBeneficiary?.type ?? '']})
              </DialogTitle>
            </DialogHeader>
            {viewBeneficiary && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</p>
                    <Badge variant={viewBeneficiary.is_active ? 'default' : 'secondary'}>
                      {viewBeneficiary.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo</p>
                    <p className="text-sm font-medium">{typeLabels[viewBeneficiary.type]}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Usuário (login)</p>
                  {viewBeneficiary.user_id ? (
                    <p className="text-sm font-mono font-medium">{viewUsername ?? '...'}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem acesso cadastrado</p>
                  )}
                </div>
                {viewBeneficiary.pix_key && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chave PIX ({viewBeneficiary.pix_key_type})</p>
                    <p className="text-sm font-mono">{viewBeneficiary.pix_key}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cadastrado em</p>
                  <p className="text-sm">{new Date(viewBeneficiary.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Send Credentials Dialog */}
        <Dialog open={!!credsBeneficiary} onOpenChange={open => !open && setCredsBeneficiary(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Enviar Credenciais — {credsBeneficiary?.name}
              </DialogTitle>
              <DialogDescription>
                Informe o WhatsApp do colaborador e a senha. Será aberta uma conversa com as credenciais prontas para enviar.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSendCredsWhatsApp} className="space-y-4">
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Input value={credsUsername} disabled className="font-mono bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="creds_whatsapp">WhatsApp do colaborador</Label>
                <Input
                  id="creds_whatsapp"
                  type="tel"
                  value={credsWhatsapp}
                  onChange={e => setCredsWhatsapp(e.target.value)}
                  placeholder="(47) 99999-9999"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="creds_password">Senha para informar</Label>
                <div className="relative">
                  <Input
                    id="creds_password"
                    type={showCredsPassword ? 'text' : 'password'}
                    value={credsPassword}
                    onChange={e => setCredsPassword(e.target.value)}
                    placeholder="Senha de acesso"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCredsPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCredsPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full">
                Abrir WhatsApp com credenciais
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Create Access Dialog */}
        <Dialog open={isAccessDialogOpen} onOpenChange={setIsAccessDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Criar Acesso — {accessBeneficiary?.name}
              </DialogTitle>
              <DialogDescription>
                O colaborador poderá acessar o painel em /admin/login com essas credenciais.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateAccess} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="access_username">Usuário</Label>
                <Input
                  id="access_username"
                  value={accessUsername}
                  onChange={e => setAccessUsername(e.target.value.toLowerCase().replace(/\s+/g, '.'))}
                  placeholder="ex: joao.silva"
                  required
                />
                <p className="text-xs text-muted-foreground">Somente letras minúsculas, números e pontos.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="access_password">Senha</Label>
                <div className="relative">
                  <Input
                    id="access_password"
                    type={showAccessPassword ? 'text' : 'password'}
                    value={accessPassword}
                    onChange={e => setAccessPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccessPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showAccessPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isCreatingAccess}>
                {isCreatingAccess ? 'Criando acesso...' : 'Criar Acesso'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>

    {/* Change Password Dialog for collaborators */}
    {changePasswordBeneficiary && (
      <ChangePasswordDialog
        username={changePasswordUsername}
        open={!!changePasswordBeneficiary}
        onOpenChange={open => { if (!open) { setChangePasswordBeneficiary(null); setChangePasswordUsername(null); } }}
      />
    )}

    <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir comissionado?</AlertDialogTitle>
          <AlertDialogDescription>
            Isso excluirá <strong>{deleteTarget?.name}</strong> permanentemente. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
      </TabsContent>
    </Tabs>
    </div>
  );
};

export default BeneficiariesManagement;
