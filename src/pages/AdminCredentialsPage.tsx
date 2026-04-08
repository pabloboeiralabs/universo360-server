import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye, EyeOff, Copy, Check, ShieldAlert, Key, Download,
  Loader2, Code2, Database, Shield, HardDrive,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CredentialsData {
  project_url: string | null;
  anon_key: string | null;
  service_role_key: string | null;
  secrets: Record<string, string>;
  edge_functions: string[];
  edge_functions_count: number;
  database_tables: any[] | null;
  rls_policies: any[] | null;
  storage_buckets: any[] | null;
}

const ESSENTIAL_TABLES = new Set(["user_roles", "profiles", "franchises", "events", "tickets", "customers"]);
const HISTORY_TABLES = new Set(["email_logs", "contact_messages"]);

const CMD_COLORS: Record<string, string> = {
  SELECT: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  INSERT: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  UPDATE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  ALL: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export default function AdminCredentialsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<CredentialsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setError("Sessão não encontrada"); return; }

      const res = await supabase.functions.invoke("admin-credentials", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) { setError(res.error.message); return; }
      setData(res.data as CredentialsData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const mask = (val: string) => val.slice(0, 8) + "•".repeat(Math.min(val.length - 8, 30));

  const copyToClipboard = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleReveal = (key: string) => setRevealed(p => ({ ...p, [key]: !p[key] }));

  const copyAllSecrets = async () => {
    if (!data) return;
    const lines = [
      `PROJECT_URL=${data.project_url}`,
      `ANON_KEY=${data.anon_key}`,
      `SERVICE_ROLE_KEY=${data.service_role_key}`,
      ...Object.entries(data.secrets).map(([k, v]) => `${k}=${v}`),
    ].join("\n");
    await navigator.clipboard.writeText(lines);
    toast({ title: "Copiado", description: "Todas as credenciais copiadas" });
  };

  const downloadSecretsTs = () => {
    if (!data) return;
    const lines = [
      "// Auto-generated secrets export",
      `export const PROJECT_URL = "${data.project_url}";`,
      `export const ANON_KEY = "${data.anon_key}";`,
      `export const SERVICE_ROLE_KEY = "${data.service_role_key}";`,
      "",
      "export const SECRETS = {",
      ...Object.entries(data.secrets).map(([k, v]) => `  ${k}: "${v}",`),
      "} as const;",
    ].join("\n");
    const blob = new Blob([lines], { type: "text/typescript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "secrets.ts"; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadRlsSql = () => {
    if (!data?.rls_policies) return;
    const lines = data.rls_policies.map((p: any) => {
      let sql = `CREATE POLICY "${p.policyname}" ON ${p.schemaname}.${p.tablename}\n  FOR ${p.cmd}\n  TO ${p.roles}`;
      if (p.qual) sql += `\n  USING (${p.qual})`;
      if (p.with_check) sql += `\n  WITH CHECK (${p.with_check})`;
      return sql + ";\n";
    }).join("\n");
    const blob = new Blob([lines], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "rls_policies.sql"; a.click();
    URL.revokeObjectURL(url);
  };

  const classifyTable = (name: string) => {
    if (ESSENTIAL_TABLES.has(name)) return "Essencial";
    if (HISTORY_TABLES.has(name)) return "Histórico";
    return "Padrão";
  };

  const tableHasRls = (tableName: string) =>
    data?.rls_policies?.some((p: any) => p.tablename === tableName) ?? false;

  const policiesByTable = () => {
    if (!data?.rls_policies) return {};
    const grouped: Record<string, any[]> = {};
    for (const p of data.rls_policies) {
      if (!grouped[p.tablename]) grouped[p.tablename] = [];
      grouped[p.tablename].push(p);
    }
    return grouped;
  };

  const SecretRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-border last:border-0">
      <span className="text-sm font-mono text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1 min-w-0">
        <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-[300px]">
          {revealed[label] ? value : mask(value)}
        </code>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleReveal(label)}>
          {revealed[label] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(label, value)}>
          {copied === label ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
            <Button onClick={fetchCredentials} className="mt-4">Tentar novamente</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const grouped = policiesByTable();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Credenciais & Infraestrutura</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyAllSecrets}>
            <Copy className="h-4 w-4 mr-1" /> Copiar Tudo
          </Button>
          <Button variant="outline" size="sm" onClick={downloadSecretsTs}>
            <Download className="h-4 w-4 mr-1" /> Download .ts
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: ShieldAlert, label: "Credenciais", value: "3" },
          { icon: Key, label: "Secrets", value: String(Object.keys(data.secrets).length) },
          { icon: Code2, label: "Edge Functions", value: String(data.edge_functions_count) },
          { icon: Database, label: "Tabelas", value: String(data.database_tables?.length ?? 0) },
          { icon: Shield, label: "Políticas RLS", value: String(data.rls_policies?.length ?? 0) },
          { icon: HardDrive, label: "Storage", value: String(data.storage_buckets?.length ?? 0) },
        ].map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1">
              <Icon className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{value}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Credenciais */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Credenciais</CardTitle></CardHeader>
          <CardContent className="space-y-0">
            {data.project_url && <SecretRow label="PROJECT_URL" value={data.project_url} />}
            {data.anon_key && <SecretRow label="ANON_KEY" value={data.anon_key} />}
            {data.service_role_key && <SecretRow label="SERVICE_ROLE_KEY" value={data.service_role_key} />}
          </CardContent>
        </Card>

        {/* Secrets */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> Secrets</CardTitle></CardHeader>
          <CardContent className="space-y-0">
            {Object.entries(data.secrets).length === 0 && <p className="text-sm text-muted-foreground">Nenhum secret adicional</p>}
            {Object.entries(data.secrets).map(([k, v]) => <SecretRow key={k} label={k} value={v} />)}
          </CardContent>
        </Card>

        {/* Edge Functions */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Code2 className="h-5 w-5" /> Edge Functions ({data.edge_functions_count})</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.edge_functions.map(fn => (
                <Badge key={fn} variant="secondary" className="font-mono text-xs">{fn}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Storage Buckets */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" /> Storage Buckets</CardTitle></CardHeader>
          <CardContent>
            {(!data.storage_buckets || data.storage_buckets.length === 0) && (
              <p className="text-sm text-muted-foreground">Nenhum bucket encontrado</p>
            )}
            {data.storage_buckets?.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="font-mono text-sm">{b.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={b.public ? "default" : "outline"} className="text-xs">
                    {b.public ? "Público" : "Privado"}
                  </Badge>
                  {b.created_at && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(b.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Tabelas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Tabelas do Banco</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Tabela</th>
                  <th className="text-left py-2 px-3">Classificação</th>
                  <th className="text-right py-2 px-3">Linhas</th>
                  <th className="text-right py-2 px-3">Colunas</th>
                  <th className="text-center py-2 px-3">RLS</th>
                </tr>
              </thead>
              <tbody>
                {data.database_tables?.map((t: any) => (
                  <tr key={t.name} className="border-b border-border hover:bg-muted/50">
                    <td className="py-2 px-3 font-mono text-xs">{t.name}</td>
                    <td className="py-2 px-3">
                      <Badge variant={classifyTable(t.name) === "Essencial" ? "default" : "outline"} className="text-xs">
                        {classifyTable(t.name)}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-right">{t.row_count}</td>
                    <td className="py-2 px-3 text-right">{t.column_count}</td>
                    <td className="py-2 px-3 text-center">
                      {tableHasRls(t.name) ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">RLS</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Políticas RLS */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Políticas RLS</CardTitle>
          <Button variant="outline" size="sm" onClick={downloadRlsSql}>
            <Download className="h-4 w-4 mr-1" /> Download .sql
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(grouped).map(([table, policies]) => (
            <div key={table}>
              <h3 className="font-mono text-sm font-semibold mb-2 text-primary">{table}</h3>
              <div className="space-y-2">
                {policies.map((p: any, i: number) => (
                  <div key={i} className="border rounded-md p-3 bg-muted/30">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={`text-xs ${CMD_COLORS[p.cmd] ?? ""}`}>{p.cmd}</Badge>
                      <span className="text-sm font-medium">{p.policyname}</span>
                      <Badge variant="outline" className="text-xs">{p.permissive === "PERMISSIVE" ? "Permissive" : "Restrictive"}</Badge>
                    </div>
                    {p.qual && (
                      <div className="mt-1">
                        <span className="text-xs text-muted-foreground">USING: </span>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded break-all">{p.qual}</code>
                      </div>
                    )}
                    {p.with_check && (
                      <div className="mt-1">
                        <span className="text-xs text-muted-foreground">WITH CHECK: </span>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded break-all">{p.with_check}</code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
