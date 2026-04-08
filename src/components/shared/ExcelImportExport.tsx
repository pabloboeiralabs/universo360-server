import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Download, Upload, FileDown, AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { ColumnDef, exportToExcel, downloadTemplate, parseExcelFile, ParsedImportData, RowValidationError } from '@/lib/excelUtils';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ExcelImportExportProps {
  data: Record<string, any>[];
  columns: ColumnDef[];
  entityName: string;
  onImport: (rows: Record<string, any>[]) => Promise<void>;
  isLoading?: boolean;
  franchiseId?: string;
}

const MAX_PREVIEW_ROWS = 50;

const ExcelImportExport = ({ data, columns, entityName, onImport, isLoading, franchiseId }: ExcelImportExportProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<ParsedImportData | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleExport = () => {
    if (!data || data.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }
    exportToExcel(data, columns, entityName);
    toast.success(`${data.length} registro(s) exportado(s)!`);
  };

  const handleTemplate = () => {
    downloadTemplate(columns, entityName);
    toast.success('Modelo baixado!');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseExcelFile(file, columns);
      if (parsed.rows.length === 0) {
        toast.error('Arquivo vazio ou sem dados válidos');
        return;
      }
      setPreviewData(parsed);
      setShowPreview(true);
    } catch (err: any) {
      toast.error('Erro ao ler arquivo: ' + err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData) return;
    setImporting(true);
    try {
      await onImport(previewData.rows);
      // Log import
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('import_logs').insert({
          entity_name: entityName,
          file_name: entityName + '.xlsx',
          total_rows: previewData.rows.length,
          new_count: previewData.newCount,
          update_count: previewData.updateCount,
          error_count: previewData.errors.length,
          imported_by: user?.id,
          franchise_id: franchiseId || null,
        } as any);
      } catch {}
      toast.success(`${previewData.rows.length} registro(s) importado(s) com sucesso!`);
      setShowPreview(false);
      setPreviewData(null);
    } catch (err: any) {
      toast.error('Erro na importação: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleCancelPreview = () => {
    setShowPreview(false);
    setPreviewData(null);
  };

  const previewColumns = columns.filter(c => c.key !== 'id').slice(0, 5);
  const hasErrors = (previewData?.errors?.length ?? 0) > 0;
  const errorsByRow = previewData?.errors?.reduce<Record<number, RowValidationError[]>>((acc, err) => {
    if (!acc[err.row]) acc[err.row] = [];
    acc[err.row].push(err);
    return acc;
  }, {}) ?? {};

  return (
    <>
      <div className="flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2" disabled={isLoading || importing}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar dados
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleTemplate}>
              <FileDown className="h-4 w-4 mr-2" />
              Baixar modelo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Importar arquivo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={showPreview} onOpenChange={(open) => !open && handleCancelPreview()}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Pré-visualização da Importação</DialogTitle>
          </DialogHeader>

          {previewData && (
            <div className="flex flex-col gap-3 overflow-hidden flex-1">
              {/* Summary badges */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1.5">
                  Total: {previewData.rows.length} registro(s)
                </Badge>
                <Badge className="gap-1.5 bg-green-600 hover:bg-green-700">
                  <Plus className="h-3 w-3" />
                  {previewData.newCount} novo(s)
                </Badge>
                <Badge className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                  <RefreshCw className="h-3 w-3" />
                  {previewData.updateCount} atualização(ões)
                </Badge>
              </div>

              {/* Errors alert */}
              {hasErrors && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{previewData.errors.length} erro(s) encontrado(s)</AlertTitle>
                  <AlertDescription>
                    <ScrollArea className="max-h-24 mt-1">
                      <ul className="text-xs space-y-0.5 list-disc pl-4">
                        {previewData.errors.map((err, i) => (
                          <li key={i}>
                            Linha {err.row} — <strong>{err.column}</strong>: {err.message}
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}

              {/* Data preview table */}
              <ScrollArea className="flex-1 min-h-0 rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14 text-xs">Linha</TableHead>
                      <TableHead className="w-16 text-xs">Ação</TableHead>
                      {previewColumns.map(col => (
                        <TableHead key={col.key} className="text-xs">{col.header}</TableHead>
                      ))}
                      {hasErrors && <TableHead className="w-10 text-xs">!</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.rows.slice(0, MAX_PREVIEW_ROWS).map((row, idx) => {
                      const rowNum = idx + 2;
                      const rowErrors = errorsByRow[rowNum];
                      const isUpdate = row.id && String(row.id).trim() !== '' && row.id !== '(não preencher para novo)';
                      return (
                        <TableRow key={idx} className={rowErrors ? 'bg-destructive/10' : ''}>
                          <TableCell className="text-xs text-muted-foreground">{rowNum}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] px-1.5 ${isUpdate ? 'border-blue-500 text-blue-600' : 'border-green-500 text-green-600'}`}>
                              {isUpdate ? 'Atualizar' : 'Novo'}
                            </Badge>
                          </TableCell>
                          {previewColumns.map(col => (
                            <TableCell key={col.key} className="text-xs max-w-[150px] truncate">
                              {String(row[col.key] ?? '')}
                            </TableCell>
                          ))}
                          {hasErrors && (
                            <TableCell>
                              {rowErrors && (
                                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {previewData.rows.length > MAX_PREVIEW_ROWS && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Mostrando {MAX_PREVIEW_ROWS} de {previewData.rows.length} registros
                  </p>
                )}
              </ScrollArea>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancelPreview} disabled={importing}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={importing || hasErrors}
            >
              {importing ? 'Importando...' : `Confirmar Importação (${previewData?.rows.length ?? 0})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ExcelImportExport;
