import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CreditCard, Eye, EyeOff, CheckCircle, AlertCircle, 
  Loader2, Trash2, FlaskConical, Copy, Check
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface AsaasSettingsProps {
  franchise: {
    id: string;
    name: string;
    asaas_api_key?: string | null;
    asaas_webhook_token?: string | null;
  };
}

const AsaasSettings = ({ franchise }: AsaasSettingsProps) => {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState(franchise.asaas_api_key || '');
  const [webhookToken, setWebhookToken] = useState(franchise.asaas_webhook_token || '');
  const [showKey, setShowKey] = useState(false);
  const [showWebhookToken, setShowWebhookToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  const webhookUrl = `https://zreuqsfwgbhrvqprxoyg.supabase.co/functions/v1/payment-webhook`;

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isConfigured = !!franchise.asaas_api_key;

  const updateSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('franchises')
        .update({ asaas_api_key: apiKey || null, asaas_webhook_token: webhookToken || null } as Record<string, unknown>)
        .eq('id', franchise.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-franchise'] });
      queryClient.invalidateQueries({ queryKey: ['admin-franchise-settings'] });
      toast.success('Configurações salvas com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar: ' + error.message);
    },
  });

  const clearSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('franchises')
        .update({ asaas_api_key: null, asaas_webhook_token: null } as Record<string, unknown>)
        .eq('id', franchise.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setApiKey('');
      setWebhookToken('');
      queryClient.invalidateQueries({ queryKey: ['user-franchise'] });
      queryClient.invalidateQueries({ queryKey: ['admin-franchise-settings'] });
      toast.success('Credenciais removidas!');
    },
    onError: (error) => {
      toast.error('Erro ao remover: ' + error.message);
    },
  });

  const handleTestCredentials = async () => {
    if (!apiKey.trim()) { toast.error('Preencha a API Key para testar'); return; }
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-asaas', {
        body: { api_key: apiKey.trim() }
      });
      console.log('validate-asaas response:', { data, error });
      if (error) { 
        console.error('validate-asaas error details:', error);
        toast.error('Erro ao validar credenciais: ' + error.message); 
        return; 
      }
      if (data?.valid) { toast.success('API Key ASAAS válida!'); }
      else { toast.error(data?.error || 'API Key inválida.'); }
    } catch (e) { 
      console.error('validate-asaas catch:', e);
      toast.error('Erro ao testar credenciais'); 
    }
    finally { setIsTesting(false); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) { toast.error('Preencha a API Key'); return; }
    updateSettings.mutate();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-primary" />
            <div>
              <CardTitle className="text-base md:text-lg">Configurações do ASAAS</CardTitle>
              <CardDescription>Configure sua API Key para receber pagamentos via PIX e Cartão</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isConfigured ? (
            <Alert className="mb-6 border-green-500/50 bg-green-500/10">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-500">
                ASAAS configurado e pronto para receber pagamentos!
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="mb-6 border-yellow-500/50 bg-yellow-500/10">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-yellow-500">
                Configure sua API Key do ASAAS para começar a receber pagamentos.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">

            <div className="space-y-2">
              <Label>URL do Webhook</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md break-all font-mono border">
                  {webhookUrl}
                </code>
                <Button type="button" variant="outline" size="icon" onClick={handleCopyWebhookUrl} className="flex-shrink-0">
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Cole esta URL no painel ASAAS em: Integrações → Webhooks → URL de Notificação
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="asaasKey">API Key ASAAS</Label>
              <div className="relative">
                <Input
                  id="asaasKey"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Sua API Key do ASAAS"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Chave de API para processar pagamentos (obtida no painel ASAAS)
              </p>
              {apiKey && apiKey.includes('_hmlg_') && (
                <Alert className="mt-2 border-orange-500/50 bg-orange-500/10">
                  <FlaskConical className="h-4 w-4 text-orange-500" />
                  <AlertDescription className="text-orange-600 dark:text-orange-400 text-xs">
                    Esta chave parece ser de <strong>homologação (sandbox)</strong>. Para processar pagamentos reais, use uma chave de produção do ASAAS.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhookToken">Token do Webhook (opcional)</Label>
              <div className="relative">
                <Input
                  id="webhookToken"
                  type={showWebhookToken ? 'text' : 'password'}
                  value={webhookToken}
                  onChange={(e) => setWebhookToken(e.target.value)}
                  placeholder="Token de autenticação do webhook"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowWebhookToken(!showWebhookToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showWebhookToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Token configurado no webhook do ASAAS para validar as notificações (Integrações → Webhooks → Token de Autenticação)
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleTestCredentials}
                  disabled={isTesting || !apiKey.trim()}
                >
                  {isTesting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Testando...</>
                  ) : (
                    <><FlaskConical className="h-4 w-4 mr-2" />Testar</>
                  )}
                </Button>
                <Button type="submit" className="flex-1" disabled={updateSettings.isPending}>
                  {updateSettings.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                  ) : (
                    'Salvar'
                  )}
                </Button>
              </div>

              {isConfigured && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" className="w-full" disabled={clearSettings.isPending}>
                      <Trash2 className="h-4 w-4 mr-2" />Desconectar ASAAS
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Desconectar ASAAS?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso irá remover a API Key. Os pagamentos não poderão ser processados até que uma nova chave seja cadastrada.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => clearSettings.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Desconectar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Como obter sua API Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-xs md:text-sm text-muted-foreground">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">1</span>
              </div>
              <p>Acesse o painel do ASAAS (www.asaas.com)</p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">2</span>
              </div>
              <p>Vá em Configurações → Integrações → API para obter a chave de API</p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">3</span>
              </div>
              <p>Em Integrações → Webhooks, copie o Token de Autenticação e cole no campo "Token do Webhook"</p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">4</span>
              </div>
              <p>Cole a API Key e o Token do Webhook nos campos acima e salve</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AsaasSettings;
