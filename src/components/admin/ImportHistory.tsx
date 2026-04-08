import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, Loader2 } from 'lucide-react';

const entityLabels: Record<string, string> = {
  clientes: 'Clientes',
  comissionados: 'Comissionados',
  franquias: 'Franquias',
  eventos: 'Eventos',
  series: 'Séries',
};

const ImportHistory = () => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['import-logs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('import_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" />
          Histórico de Importações
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !logs || logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma importação realizada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Entidade</TableHead>
                  <TableHead className="text-xs text-center">Total</TableHead>
                  <TableHead className="text-xs text-center">Novos</TableHead>
                  <TableHead className="text-xs text-center">Atualizados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">
                      {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-xs">
                      {entityLabels[log.entity_name] || log.entity_name}
                    </TableCell>
                    <TableCell className="text-xs text-center">{log.total_rows}</TableCell>
                    <TableCell className="text-xs text-center">
                      <Badge variant="outline" className="text-[10px] border-green-500 text-green-600">{log.new_count}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-center">
                      <Badge variant="outline" className="text-[10px] border-blue-500 text-blue-600">{log.update_count}</Badge>
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

export default ImportHistory;
