import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Eye, EyeOff, Copy, Check, ShieldAlert, Key, Download,
  Loader2, Code2, Database, AlertTriangle, Info, Lock,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TableRaw {
  name: string;
  row_count: number;
  column_count: number;
  encrypted_columns: string | null;
  has_user_id: boolean;
}

interface CredentialsData {
  project_url: string | null;
  anon_key: string | null;
  service_role_key: string | null;
  secrets: Record<string, string>;
  edge_functions: string[];
  edge_functions_count: number;
  database_tables?: TableRaw[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const mask = (val: string | null | undefined) => {
  if (!val) return '—';
  if (val.length <= 20) return val;
  return `${val.slice(0, 12)}•••••${val.slice(-8)}`;
};

type TableCategory = 'essencial' | 'historico' | 'ignorar';

const classifyTable = (t: TableRaw): TableCategory => {
  const n = t.name.toLowerCase();
  if (n.includes('_log') || n.includes('_history') || n.includes('migration') || n.includes('audit') || t.encrypted_columns) return 'ignorar';
  if (n.includes('settings') || n.includes('config') || n.includes('role') || (n === 'profiles' && t.has_user_id)) return 'essencial';
  if (n.includes('credit') || n.includes('subscription')) return 'essencial';
  if (n.includes('payment') || n.includes('sale') || n.includes('transaction') || n.includes('order') || n.includes('ticket')) return 'historico';
  return 'historico';
};

const classifyReason = (t: TableRaw): string => {
  const n = t.name.toLowerCase();
  if (t.encrypted_columns) return `Possui coluna(s) criptografada(s): ${t.encrypted_columns}`;
  if (n.includes('_log') || n.includes('_history')) return 'Tabela de histórico/log';
  if (n.includes('migration')) return 'Tabela de controle de migrações';
  if (n.includes('audit')) return 'Tabela de auditoria';
  if (n.includes('settings') || n.includes('config')) return 'Tabela de configuração essencial';
  if (n.includes('role')) return 'Tabela de papéis/permissões';
  if (n === 'profiles' && t.has_user_id) return 'Tabela de perfis de usuário com user_id';
  if (n.includes('credit') || n.includes('subscription')) return 'Dados de billing/assinatura críticos';
  if (n.includes('payment') || n.includes('sale') || n.includes('transaction') || n.includes('order') || n.includes('ticket')) return 'Tabela de transações/histórico financeiro';
  return 'Tabela geral de dados';
};

const categoryStyles: Record<TableCategory, { badge: string; label: string }> = {
  essencial: { badge: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700/40', label: 'Essencial' },
  historico: { badge: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700/40', label: 'Histórico' },
  ignorar: { badge: 'bg-muted text-muted-foreground border-border', label: 'Ignorar' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function SecretRow({ label, value, revealed }: { label: string; value: string | null; revealed: boolean }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const displayVal = !value ? '—' : revealed ? (show ? value : mask(value)) : '••••••••••••••••••••';

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast({ title: 'Copiado!', description: label });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground w-40 shrink-0 font-mono">{label}</span>
      <span className="flex-1 text-xs font-mono text-foreground break-all">{displayVal}</span>
      {revealed && value && (
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShow(!show)}>
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
            {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
const AdminCredentialsPage = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<CredentialsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [globalCopied, setGlobalCopied] = useState(false);

  // Password dialog state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Edge functions source via import.meta.glob (bundled at build time)
  const edgeSources = import.meta.glob('/supabase/functions/*/index.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;

  const doReveal = useCallback(async (pwd: string) => {
    if (!session?.access_token) {
      toast({ title: 'Não autenticado', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('admin-credentials', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { password: pwd },
      });
      if (error) throw error;
      if ((result as { error?: string })?.error) {
        throw new Error((result as { error: string }).error);
      }
      setData(result as CredentialsData);
      setRevealed(true);
      setShowPasswordDialog(false);
      setPassword('');
      setPasswordError('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      if (msg === 'Senha incorreta') {
        setPasswordError('Senha incorreta. Tente novamente.');
        setPassword('');
        setTimeout(() => passwordInputRef.current?.focus(), 50);
      } else {
        toast({ title: 'Erro ao buscar credenciais', description: msg, variant: 'destructive' });
        setShowPasswordDialog(false);
      }
    } finally {
      setLoading(false);
    }
  }, [session, toast]);

  const handleReveal = useCallback(() => {
    if (!session?.access_token) {
      toast({ title: 'Não autenticado', variant: 'destructive' });
      return;
    }
    setPassword('');
    setPasswordError('');
    setShowPasswordInput(false);
    setShowPasswordDialog(true);
  }, [session, toast]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setPasswordError('Digite a senha.');
      return;
    }
    doReveal(password);
  };

  const handleCopyAll = () => {
    if (!data) return;
    const lines: string[] = [
      '═══════════════════════════════════════',
      '   CREDENCIAIS DO PROJETO — Universo 360',
      `   Gerado em ${new Date().toLocaleString('pt-BR')}`,
      '═══════════════════════════════════════',
      '',
      '── SUPABASE ─────────────────────────',
      `SUPABASE_URL=${data.project_url ?? ''}`,
      `SUPABASE_ANON_KEY=${data.anon_key ?? ''}`,
      `SUPABASE_SERVICE_ROLE_KEY=${data.service_role_key ?? ''}`,
      '',
      '── SECRETS ──────────────────────────',
      ...Object.entries(data.secrets).map(([k, v]) => `${k}=${v}`),
      '',
      '═══════════════════════════════════════',
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setGlobalCopied(true);
    toast({ title: 'Tudo copiado!', description: 'Credenciais copiadas para a área de transferência.' });
    setTimeout(() => setGlobalCopied(false), 2500);
  };

  const handleDownloadSecrets = () => {
    if (!data) return;
    const now = new Date().toLocaleDateString('pt-BR');
    const entries = [
      `  SUPABASE_URL: "${data.project_url ?? ''}",`,
      `  SUPABASE_ANON_KEY: "${data.anon_key ?? ''}",`,
      `  SUPABASE_SERVICE_ROLE_KEY: "${data.service_role_key ?? ''}",`,
      ...Object.entries(data.secrets).map(([k, v]) => `  ${k}: "${v}",`),
    ];
    const content = `// Secrets do projeto - Gerado em ${now}\nexport const SECRETS = {\n${entries.join('\n')}\n} as const;\n\nexport type SecretKey = keyof typeof SECRETS;\n`;
    const blob = new Blob([content], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'secrets.ts'; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Download iniciado', description: 'secrets.ts gerado com sucesso.' });
  };

  const handleDownloadEdgeFunctions = () => {
    const entries = Object.entries(edgeSources);
    if (entries.length === 0) {
      toast({ title: 'Nenhuma função encontrada', variant: 'destructive' });
      return;
    }
    const now = new Date().toLocaleString('pt-BR');
    const parts: string[] = [
      `// Edge Functions consolidadas — Gerado em ${now}`,
      `// Total: ${entries.length} funções`,
      '',
    ];
    for (const [path, src] of entries) {
      const name = path.replace('/supabase/functions/', '').replace('/index.ts', '');
      parts.push(`${'═'.repeat(60)}`);
      parts.push(`// FUNÇÃO: ${name}`);
      parts.push(`// Arquivo: ${path}`);
      parts.push(`${'═'.repeat(60)}`);
      parts.push(src as string);
      parts.push('');
    }
    const blob = new Blob([parts.join('\n')], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'edge-functions.ts'; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Download iniciado', description: `${entries.length} funções exportadas para edge-functions.ts` });
  };

  // Summary counts
  const credCount = data ? [data.project_url, data.anon_key, data.service_role_key].filter(Boolean).length : 0;
  const secretCount = data ? Object.keys(data.secrets).length : 0;
  const fnCount = data ? data.edge_functions_count : Object.keys(edgeSources).length;
  const tableCount = data?.database_tables?.length ?? 0;

  const userTables = data?.database_tables?.filter(t =>
    ['profiles', 'user_roles'].includes(t.name)
  ) ?? [];
  const showPasswordWarning = userTables.length > 0;

  return (
    <TooltipProvider>
      {/* ─── Password Dialog ─── */}
      <Dialog open={showPasswordDialog} onOpenChange={(open) => { if (!loading) { setShowPasswordDialog(open); setPasswordError(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-destructive" />
              Verificação de segurança
            </DialogTitle>
            <DialogDescription>
              Digite a senha de acesso para revelar as credenciais do projeto.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="cred-password">Senha</Label>
              <div className="relative">
                <Input
                  id="cred-password"
                  ref={passwordInputRef}
                  type={showPasswordInput ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                  placeholder="Digite a senha..."
                  autoFocus
                  className={passwordError ? 'border-destructive focus-visible:ring-destructive' : ''}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPasswordInput(!showPasswordInput)}
                  tabIndex={-1}
                >
                  {showPasswordInput ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              {passwordError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {passwordError}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPasswordDialog(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || !password.trim()} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                {loading ? 'Verificando…' : 'Confirmar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Credenciais do Projeto</h1>
            <p className="text-sm text-muted-foreground mt-1">Acesso restrito — admin / desenvolvedor</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!revealed ? (
              <Button onClick={handleReveal} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                {loading ? 'Carregando…' : 'Revelar Tudo'}
              </Button>
            ) : (
              <>
                 <Button variant="outline" onClick={handleCopyAll} className="gap-2">
                  {globalCopied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  Copiar Tudo
                </Button>
                <Button variant="outline" onClick={handleDownloadSecrets} className="gap-2">
                  <Download className="h-4 w-4" />
                  Download .ts
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ─── 4 Summary Cards ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <ShieldAlert className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Credenciais</p>
                <p className="text-2xl font-bold">{revealed ? credCount : '—'}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Secrets</p>
                <p className="text-2xl font-bold">{revealed ? secretCount : '—'}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary">
                <Code2 className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Edge Functions</p>
                <p className="text-2xl font-bold">{fnCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary">
                <Database className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tabelas</p>
                <p className="text-2xl font-bold">{revealed ? tableCount : '—'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Password warning ─── */}
        {showPasswordWarning && (
          <div className="flex gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>
              <strong>Atenção — Tabelas de usuários detectadas ({userTables.map(t => t.name).join(', ')}):</strong>{' '}
              Usuários migrados precisam redefinir a senha via "Esqueci minha senha". Emails e metadados são copiados, mas senhas são hashes irreversíveis.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ─── Credentials Card ─── */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive" />
                Credenciais Supabase
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!revealed ? (
                <p className="text-sm text-muted-foreground">Clique em "Revelar Tudo" para exibir.</p>
              ) : (
                <div>
                  <SecretRow label="SUPABASE_URL" value={data?.project_url ?? null} revealed={revealed} />
                  <SecretRow label="ANON_KEY" value={data?.anon_key ?? null} revealed={revealed} />
                  <SecretRow label="SERVICE_ROLE_KEY" value={data?.service_role_key ?? null} revealed={revealed} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Secrets Card ─── */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                Secrets configurados
                {revealed && <Badge variant="secondary" className="ml-auto">{secretCount}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!revealed ? (
                <p className="text-sm text-muted-foreground">Clique em "Revelar Tudo" para exibir.</p>
              ) : secretCount === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum secret extra configurado.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {Object.entries(data?.secrets ?? {}).map(([k, v]) => (
                    <SecretRow key={k} label={k} value={v} revealed={revealed} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Edge Functions Card (col-span-2) ─── */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Code2 className="h-4 w-4 text-secondary-foreground" />
                Edge Functions
                {revealed && <Badge variant="secondary">{data?.edge_functions_count ?? 0} descobertas</Badge>}
                <Badge variant="outline" className="text-xs">{Object.keys(edgeSources).length} no build</Badge>
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleDownloadEdgeFunctions} className="gap-2">
                <Download className="h-3.5 w-3.5" />
                Download edge-functions.ts
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {revealed && data?.edge_functions && data.edge_functions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.edge_functions.map((fn) => (
                  <Badge key={fn} variant="outline" className="font-mono text-xs bg-secondary text-secondary-foreground">
                    {fn}
                  </Badge>
                ))}
              </div>
            ) : !revealed ? (
              <div className="flex flex-wrap gap-2">
                {Object.keys(edgeSources).map((path) => {
                  const name = path.replace('/supabase/functions/', '').replace('/index.ts', '');
                  return (
                    <Badge key={name} variant="outline" className="font-mono text-xs">
                      {name}
                    </Badge>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma função descoberta via probe.</p>
            )}
          </CardContent>
        </Card>

        {/* ─── Database Tables Card ─── */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-foreground" />
              Tabelas do Banco
              {revealed && <Badge variant="secondary">{tableCount} públicas</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!revealed ? (
              <p className="text-sm text-muted-foreground">Clique em "Revelar Tudo" para exibir.</p>
            ) : tableCount === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tabela encontrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium">Tabela</th>
                      <th className="text-center py-2 pr-4 text-xs text-muted-foreground font-medium">Linhas</th>
                      <th className="text-center py-2 pr-4 text-xs text-muted-foreground font-medium">Colunas</th>
                      <th className="text-center py-2 pr-4 text-xs text-muted-foreground font-medium">user_id</th>
                      <th className="text-left py-2 text-xs text-muted-foreground font-medium">Classificação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.database_tables ?? []).map((t) => {
                      const cat = classifyTable(t);
                      const reason = classifyReason(t);
                      const style = categoryStyles[cat];
                      return (
                        <tr key={t.name} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-2 pr-4 font-mono text-xs">{t.name}</td>
                          <td className="py-2 pr-4 text-center text-xs tabular-nums">{t.row_count.toLocaleString('pt-BR')}</td>
                          <td className="py-2 pr-4 text-center text-xs tabular-nums">{t.column_count}</td>
                          <td className="py-2 pr-4 text-center">
                            {t.has_user_id
                              ? <Check className="h-3.5 w-3.5 text-primary mx-auto" />
                              : <span className="text-muted-foreground text-xs">—</span>
                            }
                          </td>
                          <td className="py-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5 cursor-default w-fit">
                                  <Badge className={`text-xs border ${style.badge}`}>{style.label}</Badge>
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs text-xs">
                                {reason}
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default AdminCredentialsPage;
