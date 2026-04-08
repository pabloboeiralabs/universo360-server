import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Search, FileText, Loader2, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { masks, validators } from '@/lib/masks';
import { fetchAddressByCEP } from '@/lib/viacep';
import CustomerReport from './CustomerReport';
import ExcelImportExport from '@/components/shared/ExcelImportExport';
import { ColumnDef } from '@/lib/excelUtils';

const validateEmail = (v: any) => {
  if (!v || String(v).trim() === '') return null;
  return validators.email(String(v)) ? null : 'E-mail inválido';
};

const validatePhone = (v: any) => {
  if (!v || String(v).trim() === '') return null;
  const digits = String(v).replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11 ? null : 'Telefone inválido (10 ou 11 dígitos)';
};

const customerExcelColumns: ColumnDef[] = [
  { key: 'id', header: 'ID', width: 36 },
  { key: 'name', header: 'Nome', width: 30, required: true },
  { key: 'classification', header: 'Classificação', width: 15 },
  { key: 'cnpj', header: 'CNPJ', width: 20 },
  { key: 'cpf', header: 'CPF', width: 16 },
  { key: 'email', header: 'E-mail', width: 25, validate: validateEmail },
  { key: 'phone', header: 'Telefone', width: 16, validate: validatePhone },
  { key: 'whatsapp', header: 'WhatsApp', width: 16, validate: validatePhone },
  { key: 'contact_name', header: 'Responsável', width: 20 },
  { key: 'contact_whatsapp', header: 'WhatsApp Responsável', width: 16, validate: validatePhone },
  { key: 'cep', header: 'CEP', width: 10 },
  { key: 'street', header: 'Rua', width: 25 },
  { key: 'number', header: 'Número', width: 8 },
  { key: 'neighborhood', header: 'Bairro', width: 18 },
  { key: 'city', header: 'Cidade', width: 18 },
  { key: 'state', header: 'UF', width: 5 },
  { key: 'pix_key', header: 'Chave PIX', width: 20 },
  { key: 'pix_key_type', header: 'Tipo PIX', width: 10 },
  { key: 'is_active', header: 'Ativo', width: 6, transform: (v: boolean) => v ? 'Sim' : 'Não', parse: (v: any) => String(v).toLowerCase() === 'sim' || v === true },
];

interface Customer {
  id: string;
  franchise_id: string;
  name: string;
  cnpj: string | null;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  reference_point: string | null;
  is_active: boolean;
  created_at: string;
}

interface CustomerForm {
  name: string;
  classification: string;
  cnpj: string;
  cpf: string;
  email: string;
  phone: string;
  whatsapp: string;
  contact_name: string;
  contact_whatsapp: string;
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  reference_point: string;
  pix_key: string;
  pix_key_type: string;
}

const initialForm: CustomerForm = {
  name: '',
  classification: '',
  cnpj: '',
  cpf: '',
  email: '',
  phone: '',
  whatsapp: '',
  contact_name: '',
  contact_whatsapp: '',
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  city: '',
  state: '',
  reference_point: '',
  pix_key: '',
  pix_key_type: 'CPF',
};

interface CustomersManagementProps {
  franchiseId?: string;
  sellerBeneficiaryId?: string;
}

const CustomersManagement = ({ franchiseId, sellerBeneficiaryId }: CustomersManagementProps) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [reportCustomer, setReportCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(initialForm);
  const [isLoadingCEP, setIsLoadingCEP] = useState(false);

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', franchiseId, sellerBeneficiaryId],
    queryFn: async () => {
      let query = supabase
        .from('customers')
        .select('*')
        .order('name', { ascending: true });

      if (franchiseId) {
        query = query.eq('franchise_id', franchiseId);
      }

      if (sellerBeneficiaryId) {
        query = query.eq('seller_id', sellerBeneficiaryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Customer[];
    },
  });

  const createCustomer = useMutation({
    mutationFn: async (data: CustomerForm) => {
      if (!franchiseId) throw new Error('Franchise ID is required');
      
      const { error } = await supabase.from('customers').insert({
        franchise_id: franchiseId,
        name: data.name,
        classification: data.classification || null,
        cnpj: data.cnpj || null,
        cpf: data.cpf || null,
        email: data.email || null,
        phone: data.phone || null,
        whatsapp: data.whatsapp || null,
        contact_name: data.contact_name || null,
        contact_whatsapp: data.contact_whatsapp || null,
        cep: data.cep || null,
        street: data.street || null,
        number: data.number || null,
        neighborhood: data.neighborhood || null,
        city: data.city || null,
        state: data.state || null,
        reference_point: data.reference_point || null,
        pix_key: (data as any).pix_key || null,
        pix_key_type: (data as any).pix_key_type || null,
        seller_id: sellerBeneficiaryId || null,
      } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsCreateOpen(false);
      setForm(initialForm);
      toast.success('Cliente cadastrado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao cadastrar cliente: ' + error.message);
    },
  });

  const updateCustomer = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CustomerForm }) => {
      const { error } = await supabase
        .from('customers')
        .update({
          name: data.name,
          classification: data.classification || null,
          cnpj: data.cnpj || null,
          cpf: data.cpf || null,
          email: data.email || null,
          phone: data.phone || null,
          whatsapp: data.whatsapp || null,
          contact_name: data.contact_name || null,
          contact_whatsapp: data.contact_whatsapp || null,
          cep: data.cep || null,
          street: data.street || null,
          number: data.number || null,
          neighborhood: data.neighborhood || null,
          city: data.city || null,
          state: data.state || null,
          reference_point: data.reference_point || null,
          pix_key: (data as any).pix_key || null,
          pix_key_type: (data as any).pix_key_type || null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setEditingCustomer(null);
      setForm(initialForm);
      toast.success('Cliente atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar cliente: ' + error.message);
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('customers')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Status atualizado!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar status: ' + error.message);
    },
  });

  const deleteCustomer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Cliente excluído com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir cliente: ' + error.message);
    },
  });

  const handleCEPChange = async (cep: string) => {
    const maskedCEP = masks.cep(cep);
    setForm({ ...form, cep: maskedCEP });

    const cleanCEP = maskedCEP.replace(/\D/g, '');
    if (cleanCEP.length === 8) {
      setIsLoadingCEP(true);
      const address = await fetchAddressByCEP(cleanCEP);
      setIsLoadingCEP(false);

      if (address) {
        setForm((prev) => ({
          ...prev,
          street: address.street,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
        }));
        toast.success('Endereço encontrado!');
      } else {
        toast.error('CEP não encontrado');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Nome do cliente é obrigatório');
      return;
    }

    if (editingCustomer) {
      updateCustomer.mutate({ id: editingCustomer.id, data: form });
    } else {
      createCustomer.mutate(form);
    }
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name,
      classification: (customer as any).classification || '',
      cnpj: customer.cnpj || '',
      cpf: customer.cpf || '',
      email: customer.email || '',
      phone: customer.phone || '',
      whatsapp: customer.whatsapp || '',
      contact_name: (customer as any).contact_name || '',
      contact_whatsapp: (customer as any).contact_whatsapp || '',
      cep: customer.cep || '',
      street: customer.street || '',
      number: customer.number || '',
      neighborhood: customer.neighborhood || '',
      city: customer.city || '',
      state: customer.state || '',
      reference_point: customer.reference_point || '',
      pix_key: (customer as any).pix_key || '',
      pix_key_type: (customer as any).pix_key_type || 'CPF',
    });
  };

  const filteredCustomers = customers?.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.cnpj && customer.cnpj.includes(searchTerm)) ||
      (customer.cpf && customer.cpf.includes(searchTerm))
  );

  const customerFormFieldsJSX = (
    <div className="space-y-4">
      {/* Main info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome do Cliente / Escola *</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Colégio Adventista"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="classification">Classificação</Label>
          <Select value={form.classification} onValueChange={(v) => setForm({ ...form, classification: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="particular">Particular</SelectItem>
              <SelectItem value="municipal">Municipal</SelectItem>
              <SelectItem value="estadual">Estadual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cnpj">CNPJ (Pessoa Jurídica)</Label>
          <Input
            id="cnpj"
            value={form.cnpj}
            onChange={(e) => setForm({ ...form, cnpj: masks.cnpj(e.target.value), cpf: '' })}
            placeholder="00.000.000/0000-00"
            disabled={!!form.cpf}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cpf">CPF (Pessoa Física)</Label>
          <Input
            id="cpf"
            value={form.cpf}
            onChange={(e) => setForm({ ...form, cpf: masks.cpf(e.target.value), cnpj: '' })}
            placeholder="000.000.000-00"
            disabled={!!form.cnpj}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Preencha CNPJ para escolas/empresas ou CPF para pessoa física. Um exclui o outro.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="contato@escola.com.br"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: masks.phone(e.target.value) })}
            placeholder="(00) 0000-0000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input
            id="whatsapp"
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: masks.cellphone(e.target.value) })}
            placeholder="(00) 90000-0000"
          />
        </div>
      </div>

      {/* Responsável */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contact_name">Nome do Responsável</Label>
          <Input
            id="contact_name"
            value={form.contact_name}
            onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
            placeholder="Ex: Maria Silva"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact_whatsapp">WhatsApp do Responsável</Label>
          <Input
            id="contact_whatsapp"
            value={form.contact_whatsapp}
            onChange={(e) => setForm({ ...form, contact_whatsapp: masks.cellphone(e.target.value) })}
            placeholder="(00) 90000-0000"
          />
        </div>
      </div>

      {/* Address section */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium mb-4">Endereço</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cep">CEP</Label>
            <div className="relative">
              <Input
                id="cep"
                value={form.cep}
                onChange={(e) => handleCEPChange(e.target.value)}
                placeholder="00000-000"
              />
              {isLoadingCEP && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="street">Rua/Logradouro</Label>
            <Input
              id="street"
              value={form.street}
              onChange={(e) => setForm({ ...form, street: e.target.value })}
              placeholder="Rua das Flores"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="number">Número</Label>
            <Input
              id="number"
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
              placeholder="123"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="neighborhood">Bairro</Label>
            <Input
              id="neighborhood"
              value={form.neighborhood}
              onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
              placeholder="Centro"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="São Paulo"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">Estado (UF)</Label>
            <Input
              id="state"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })}
              placeholder="SP"
              maxLength={2}
            />
          </div>
        </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="reference_point">Ponto de Referência</Label>
            <Input
              id="reference_point"
              value={form.reference_point}
              onChange={(e) => setForm({ ...form, reference_point: e.target.value })}
              placeholder="Próximo ao mercado..."
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Chave PIX <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Select value={form.pix_key_type} onValueChange={(v) => setForm({ ...form, pix_key_type: v })}>
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
              <Label htmlFor="customer_pix_key">Chave PIX <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input
                id="customer_pix_key"
                value={form.pix_key}
                onChange={(e) => setForm({ ...form, pix_key: e.target.value })}
                placeholder="Chave PIX para receber comissões"
              />
            </div>
          </div>
      </div>
    </div>
  );

  if (reportCustomer) {
    return (
      <CustomerReport
        customer={reportCustomer}
        onBack={() => setReportCustomer(null)}
      />
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <CardTitle>Clientes</CardTitle>
          <CardDescription>
            {filteredCustomers?.length || 0} cliente(s) cadastrado(s)
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <ExcelImportExport
            data={customers || []}
            columns={customerExcelColumns}
            entityName="clientes"
            onImport={async (rows) => {
              if (!franchiseId) throw new Error('Franchise ID é obrigatório');
              for (const row of rows) {
                const payload = {
                  name: row.name || '',
                  classification: row.classification || null,
                  cnpj: row.cnpj || null,
                  cpf: row.cpf || null,
                  email: row.email || null,
                  phone: row.phone || null,
                  whatsapp: row.whatsapp || null,
                  contact_name: row.contact_name || null,
                  contact_whatsapp: row.contact_whatsapp || null,
                  cep: row.cep || null,
                  street: row.street || null,
                  number: row.number || null,
                  neighborhood: row.neighborhood || null,
                  city: row.city || null,
                  state: row.state || null,
                  pix_key: row.pix_key || null,
                  pix_key_type: row.pix_key_type || null,
                  is_active: row.is_active !== undefined ? row.is_active : true,
                  franchise_id: franchiseId,
                  seller_id: sellerBeneficiaryId || null,
                };
                if (row.id && row.id !== '(não preencher para novo)') {
                  await supabase.from('customers').update(payload).eq('id', row.id);
                } else {
                  await supabase.from('customers').insert(payload as any);
                }
              }
              queryClient.invalidateQueries({ queryKey: ['customers'] });
            }}
          />
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setForm(initialForm); setEditingCustomer(null); }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                {customerFormFieldsJSX}
                <Button
                  type="submit"
                  className="w-full mt-6"
                  disabled={createCustomer.isPending}
                >
                  {createCustomer.isPending ? 'Cadastrando...' : 'Cadastrar Cliente'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CNPJ ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
          </div>
        ) : filteredCustomers?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum cliente encontrado
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">CNPJ/CPF</TableHead>
                  <TableHead className="hidden md:table-cell">Cidade/UF</TableHead>
                  <TableHead className="hidden md:table-cell">Telefone</TableHead>
                  <TableHead className="hidden md:table-cell">Responsável</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers?.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell className="hidden md:table-cell">{customer.cnpj || customer.cpf || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {customer.city && customer.state
                        ? `${customer.city}/${customer.state}`
                        : '-'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{customer.phone || customer.whatsapp || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1">
                        <span>{(customer as any).contact_name || '-'}</span>
                        {(customer as any).contact_whatsapp && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-600 hover:text-green-700"
                            onClick={() => {
                              const phone = (customer as any).contact_whatsapp.replace(/\D/g, '');
                              window.open(`https://wa.me/55${phone}`, '_blank');
                            }}
                            title="Enviar WhatsApp"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={customer.is_active}
                        onCheckedChange={(checked) =>
                          toggleActive.mutate({ id: customer.id, isActive: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setReportCustomer(customer)}
                          title="Ver relatório"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Dialog
                          open={editingCustomer?.id === customer.id}
                          onOpenChange={(open) => !open && setEditingCustomer(null)}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => openEdit(customer)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Editar Cliente</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit}>
                              {customerFormFieldsJSX}
                              <Button
                                type="submit"
                                className="w-full mt-6"
                                disabled={updateCustomer.isPending}
                              >
                                {updateCustomer.isPending ? 'Salvando...' : 'Salvar Alterações'}
                              </Button>
                            </form>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            if (confirm('Tem certeza que deseja excluir este cliente?')) {
                              deleteCustomer.mutate(customer.id);
                            }
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
      </CardContent>
    </Card>
  );
};

export default CustomersManagement;
