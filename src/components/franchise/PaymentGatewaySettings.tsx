import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CreditCard, Eye, EyeOff, CheckCircle, AlertCircle,
  Loader2, Trash2, FlaskConical, RefreshCw,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface PaymentGatewaySettingsProps {
  franchise: {
    id: string;
    name: string;
    asaas_api_key?: string | null;
    asaas_webhook_token?: string | null;
    pagbank_token?: string | null;
    mercadopago_access_token?: string | null;
    mercadopago_public_key?: string | null;
    payment_gateway?: string | null;
  };
}

type GatewayTab = 'asaas' | 'pagbank' | 'mercadopago';

const gatewayLabels: Record<GatewayTab, string> = {
  asaas: 'ASAAS',
  pagbank: 'PagBank',
  mercadopago: 'Mercado Pago',
};

const PaymentGatewaySettings = ({ franchise }: PaymentGatewaySettingsProps) => {
  const queryClient = useQueryClient();
  const activeGateway = ((franchise as any).payment_gateway || 'asaas') as GatewayTab;

  // ASAAS
  const [asaasKey, setAsaasKey] = useState(franchise.asaas_api_key || '');
  const [webhookToken, setWebhookToken] = useState(franchise.asaas_webhook_token || '');
  const [showAsaasKey, setShowAsaasKey] = useState(false);
  const [showWebhookToken, setShowWebhookToken] = useState(false);

  // PagBank
  const [pagbankToken, setPagbankToken] = useState((franchise as any).pagbank_token || '');
  const [showPagbankToken, setShowPagbankToken] = useState(false);

  // Mercado Pago
  const [mpAccessToken, setMpAccessToken] = useState(franchise.mercadopago_access_token || '');
  const [mpPublicKey, setMpPublicKey] = useState(franchise.mercadopago_public_key || '');
  const [showMpToken, setShowMpToken] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);

  const handleReconcile = async () => {
    setIsReconciling(true);
    try {
      const { data, error } = await supabase.functions.invoke('reconcile-pending-payments');
      if (error) throw error;
      const { approved, checked, errors } = data as { approved: number; checked: number; errors: number };
      if (approved > 0) {
        toast.success(`${approved} de ${checked} ingressos aprovados com sucesso!`);
      } else {
        toast.info(`Verificados ${checked} ingressos pendentes — nenhum novo aprovado.${errors > 0 ? ` (${errors} erros)` : ''}`);
      }
    } catch (e: any) {
      toast.error('Erro ao reconciliar: ' + e.message);
    } finally {
      setIsReconciling(false);
    }
  };

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['user-franchise'] });
    queryClient.invalidateQueries({ queryKey: ['admin-franchise-settings'] });
  };

  // ── Set active gateway ──
  const setActiveGateway = useMutation({
    mutationFn: async (gw: GatewayTab) => {
      const { error } = await supabase.from('franchises')
        .update({ payment_gateway: gw } as any)
        .eq('id', franchise.id);
      if (error) throw error;
    },
    onSuccess: (_, gw) => { invalidateQueries(); toast.success(`${gatewayLabels[gw]} definido como gateway principal!`); },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  // ── Save mutations ──
  const saveAsaas = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('franchises')
        .update({ asaas_api_key: asaasKey || null, asaas_webhook_token: webhookToken || null } as any)
        .eq('id', franchise.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateQueries(); toast.success('Credenciais ASAAS salvas!'); },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const savePagbank = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('franchises')
        .update({ pagbank_token: pagbankToken || null } as any)
        .eq('id', franchise.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateQueries(); toast.success('Credenciais PagBank salvas!'); },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const saveMercadoPago = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('franchises')
        .update({ mercadopago_access_token: mpAccessToken || null, mercadopago_public_key: mpPublicKey || null } as any)
        .eq('id', franchise.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateQueries(); toast.success('Credenciais Mercado Pago salvas!'); },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const clearGateway = useMutation({
    mutationFn: async (gw: GatewayTab) => {
      const updates: Record<string, unknown> = {};
      if (gw === 'asaas') { updates.asaas_api_key = null; updates.asaas_webhook_token = null; }
      else if (gw === 'pagbank') { updates.pagbank_token = null; }
      else if (gw === 'mercadopago') { updates.mercadopago_access_token = null; updates.mercadopago_public_key = null; }
      const { error } = await supabase.from('franchises').update(updates as any).eq('id', franchise.id);
      if (error) throw error;
    },
    onSuccess: (_, gw) => {
      if (gw === 'asaas') { setAsaasKey(''); setWebhookToken(''); }
      else if (gw === 'pagbank') { setPagbankToken(''); }
      else if (gw === 'mercadopago') { setMpAccessToken(''); setMpPublicKey(''); }
      invalidateQueries();
      toast.success('Credenciais removidas!');
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  // ── Test credentials ──
  const handleTest = async (gw: GatewayTab) => {
    setIsTesting(true);
    try {
      if (gw === 'asaas') {
        if (!asaasKey.trim()) { toast.error('Preencha a API Key'); return; }
        const { data, error } = await supabase.functions.invoke('validate-asaas', { body: { api_key: asaasKey.trim() } });
        if (error) { toast.error('Erro ao validar'); return; }
        data?.valid ? toast.success('API Key ASAAS válida!') : toast.error(data?.error || 'API Key inválida');
      } else if (gw === 'pagbank') {
        if (!pagbankToken.trim()) { toast.error('Preencha o Token'); return; }
        const { data, error } = await supabase.functions.invoke('validate-pagbank', { body: { token: pagbankToken.trim() } });
        if (error) { toast.error('Erro ao validar'); return; }
        data?.valid ? toast.success('Token PagBank válido!') : toast.error(data?.error || 'Token inválido');
      } else if (gw === 'mercadopago') {
        if (!mpAccessToken.trim()) { toast.error('Preencha o Access Token'); return; }
        const { data, error } = await supabase.functions.invoke('validate-mercadopago', { body: { access_token: mpAccessToken.trim() } });
        if (error) { toast.error('Erro ao validar'); return; }
        data?.valid ? toast.success('Access Token Mercado Pago válido!') : toast.error(data?.error || 'Token inválido');
      }
    } catch { toast.error('Erro ao testar credenciais'); }
    finally { setIsTesting(false); }
  };

  const PasswordInput = ({ value, onChange, show, onToggle, placeholder, id }: {
    value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder: string; id: string;
  }) => (
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pr-10" />
      <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );

  const ActionButtons = ({ gw, isConfigured, isPending, onSubmit }: {
    gw: GatewayTab; isConfigured: boolean; isPending: boolean; onSubmit: () => void;
  }) => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col md:flex-row gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={() => handleTest(gw)} disabled={isTesting}>
          {isTesting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Testando...</> : <><FlaskConical className="h-4 w-4 mr-2" />Testar</>}
        </Button>
        <Button type="button" className="flex-1" onClick={onSubmit} disabled={isPending}>
          {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Salvar Credenciais'}
        </Button>
      </div>
      {isConfigured && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" className="w-full" disabled={clearGateway.isPending}>
              <Trash2 className="h-4 w-4 mr-2" />Desconectar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desconectar gateway?</AlertDialogTitle>
              <AlertDialogDescription>As credenciais serão removidas e os pagamentos não serão processados por este gateway.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => clearGateway.mutate(gw)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Desconectar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );

  const StatusBadge = ({ isConfigured }: { isConfigured: boolean }) => (
    isConfigured
      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle className="h-3 w-3" /><span className="hidden md:inline">Configurado</span></span>
      : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><AlertCircle className="h-3 w-3" /><span className="hidden md:inline">Pendente</span></span>
  );

  return (
    <div className="space-y-6">
      {/* Reconciliation Card */}
      <Card className="border-dashed">
        <CardHeader className="p-4 md:p-6 pb-3">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-sm md:text-base">Reconciliar Pagamentos Pendentes</CardTitle>
              <CardDescription className="text-xs">Verifica no gateway se ingressos pendentes já foram pagos e atualiza automaticamente</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
          <Button variant="outline" onClick={handleReconcile} disabled={isReconciling} className="w-full md:w-auto">
            {isReconciling ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verificando...</> : <><RefreshCw className="h-4 w-4 mr-2" />Reconciliar agora</>}
          </Button>
        </CardContent>
      </Card>
      {/* Gateway Selector */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-primary" />
            <div>
              <CardTitle className="text-base md:text-lg">Gateway Principal</CardTitle>
              <CardDescription>Selecione qual gateway será usado para processar pagamentos</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
          <div className="flex items-center gap-4">
            <Select value={activeGateway} onValueChange={(v) => setActiveGateway.mutate(v as GatewayTab)} disabled={setActiveGateway.isPending}>
              <SelectTrigger className="w-full max-w-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="asaas">ASAAS</SelectItem>
                <SelectItem value="pagbank">PagBank</SelectItem>
                <SelectItem value="mercadopago">Mercado Pago</SelectItem>
              </SelectContent>
            </Select>
            {setActiveGateway.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </CardContent>
      </Card>

      {/* Credentials Tabs */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg">Credenciais dos Gateways</CardTitle>
          <CardDescription>Configure as credenciais de cada gateway. Você pode configurar todos e alternar o principal acima.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
          <Tabs defaultValue={activeGateway} className="w-full">
            <TabsList className="flex flex-col md:grid md:grid-cols-3 w-full h-auto md:h-10 mb-6">
              <TabsTrigger value="asaas" className="gap-1 text-xs md:text-sm w-full justify-between">
                ASAAS <StatusBadge isConfigured={!!franchise.asaas_api_key} />
              </TabsTrigger>
              <TabsTrigger value="pagbank" className="gap-1 text-xs md:text-sm w-full justify-between">
                PagBank <StatusBadge isConfigured={!!(franchise as any).pagbank_token} />
              </TabsTrigger>
              <TabsTrigger value="mercadopago" className="gap-1 text-xs md:text-sm w-full justify-between">
                Mercado Pago <StatusBadge isConfigured={!!franchise.mercadopago_access_token} />
              </TabsTrigger>
            </TabsList>

            {/* ── ASAAS ── */}
            <TabsContent value="asaas" className="space-y-4">
              {activeGateway === 'asaas' && (
                <Alert className="border-primary/50 bg-primary/5">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-primary">Este é o gateway ativo para pagamentos.</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label>API Key ASAAS</Label>
                <PasswordInput id="asaasKey" value={asaasKey} onChange={setAsaasKey} show={showAsaasKey} onToggle={() => setShowAsaasKey(!showAsaasKey)} placeholder="Sua API Key do ASAAS" />
                <p className="text-xs text-muted-foreground">Obtida em Configurações → Integrações → API no painel ASAAS</p>
              </div>
              <div className="space-y-2">
                <Label>Token do Webhook (opcional)</Label>
                <PasswordInput id="webhookToken" value={webhookToken} onChange={setWebhookToken} show={showWebhookToken} onToggle={() => setShowWebhookToken(!showWebhookToken)} placeholder="Token de autenticação do webhook" />
                <p className="text-xs text-muted-foreground">Integrações → Webhooks → Token de Autenticação</p>
              </div>
              <ActionButtons gw="asaas" isConfigured={!!franchise.asaas_api_key} isPending={saveAsaas.isPending} onSubmit={() => { if (!asaasKey.trim()) { toast.error('Preencha a API Key'); return; } saveAsaas.mutate(); }} />
            </TabsContent>

            {/* ── PAGBANK ── */}
            <TabsContent value="pagbank" className="space-y-4">
              {activeGateway === 'pagbank' && (
                <Alert className="border-primary/50 bg-primary/5">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-primary">Este é o gateway ativo para pagamentos.</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label>Token PagBank</Label>
                <PasswordInput id="pagbankToken" value={pagbankToken} onChange={setPagbankToken} show={showPagbankToken} onToggle={() => setShowPagbankToken(!showPagbankToken)} placeholder="Seu Token do PagBank" />
                <p className="text-xs text-muted-foreground">Obtido no painel PagBank em Configurações → Integrações</p>
              </div>
              <ActionButtons gw="pagbank" isConfigured={!!(franchise as any).pagbank_token} isPending={savePagbank.isPending} onSubmit={() => { if (!pagbankToken.trim()) { toast.error('Preencha o Token'); return; } savePagbank.mutate(); }} />
            </TabsContent>

            {/* ── MERCADO PAGO ── */}
            <TabsContent value="mercadopago" className="space-y-4">
              {activeGateway === 'mercadopago' && (
                <Alert className="border-primary/50 bg-primary/5">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-primary">Este é o gateway ativo para pagamentos.</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label>Access Token</Label>
                <PasswordInput id="mpAccessToken" value={mpAccessToken} onChange={setMpAccessToken} show={showMpToken} onToggle={() => setShowMpToken(!showMpToken)} placeholder="Seu Access Token do Mercado Pago" />
                <p className="text-xs text-muted-foreground">Obtido em Seu Negócio → Configurações → Credenciais de produção</p>
              </div>
              <div className="space-y-2">
                <Label>Public Key (opcional)</Label>
                <Input value={mpPublicKey} onChange={(e) => setMpPublicKey(e.target.value)} placeholder="Public Key do Mercado Pago" />
                <p className="text-xs text-muted-foreground">Necessária para tokenização de cartão no frontend</p>
              </div>
              <ActionButtons gw="mercadopago" isConfigured={!!franchise.mercadopago_access_token} isPending={saveMercadoPago.isPending} onSubmit={() => { if (!mpAccessToken.trim()) { toast.error('Preencha o Access Token'); return; } saveMercadoPago.mutate(); }} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentGatewaySettings;
