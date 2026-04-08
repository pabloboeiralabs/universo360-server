import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import ExcelImportExport from '@/components/shared/ExcelImportExport';
import { ColumnDef } from '@/lib/excelUtils';

const gradeExcelColumns: ColumnDef[] = [
  { key: 'id', header: 'ID', width: 36 },
  { key: 'name', header: 'Nome', width: 25, required: true },
  { key: 'display_order', header: 'Ordem', width: 8, parse: (v: any) => parseInt(v) || 0 },
  { key: 'is_active', header: 'Ativo', width: 6, transform: (v: boolean) => v ? 'Sim' : 'Não', parse: (v: any) => String(v).toLowerCase() === 'sim' || v === true },
];
interface Grade {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

interface GradeForm {
  name: string;
  display_order: string;
}

const initialForm: GradeForm = {
  name: '',
  display_order: '0',
};

const GradesManagement = () => {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [form, setForm] = useState<GradeForm>(initialForm);

  const { data: grades, isLoading } = useQuery({
    queryKey: ['grades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grades')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as Grade[];
    },
  });

  const createGrade = useMutation({
    mutationFn: async (data: GradeForm) => {
      const { error } = await supabase.from('grades').insert({
        name: data.name,
        display_order: parseInt(data.display_order) || 0,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      setIsCreateOpen(false);
      setForm(initialForm);
      toast.success('Série cadastrada com sucesso!');
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate key')) {
        toast.error('Já existe uma série com este nome');
      } else {
        toast.error('Erro ao cadastrar série: ' + error.message);
      }
    },
  });

  const updateGrade = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: GradeForm }) => {
      const { error } = await supabase
        .from('grades')
        .update({
          name: data.name,
          display_order: parseInt(data.display_order) || 0,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      setEditingGrade(null);
      setForm(initialForm);
      toast.success('Série atualizada com sucesso!');
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate key')) {
        toast.error('Já existe uma série com este nome');
      } else {
        toast.error('Erro ao atualizar série: ' + error.message);
      }
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('grades')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      toast.success('Status atualizado!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar status: ' + error.message);
    },
  });

  const deleteGrade = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('grades').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      toast.success('Série excluída com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir série: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Nome da série é obrigatório');
      return;
    }

    if (editingGrade) {
      updateGrade.mutate({ id: editingGrade.id, data: form });
    } else {
      createGrade.mutate(form);
    }
  };

  const openEdit = (grade: Grade) => {
    setEditingGrade(grade);
    setForm({
      name: grade.name,
      display_order: grade.display_order.toString(),
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <CardTitle className="text-base md:text-lg">Séries / Turmas</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            {grades?.length || 0} série(s) cadastrada(s) - Lista global disponível para todos os eventos
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <ExcelImportExport
            data={grades || []}
            columns={gradeExcelColumns}
            entityName="series"
            onImport={async (rows) => {
              for (const row of rows) {
                const payload = {
                  name: row.name || '',
                  display_order: row.display_order ?? 0,
                  is_active: row.is_active !== undefined ? row.is_active : true,
                };
                if (row.id && row.id !== '(não preencher para novo)') {
                  await supabase.from('grades').update(payload).eq('id', row.id);
                } else {
                  await supabase.from('grades').insert(payload);
                }
              }
              queryClient.invalidateQueries({ queryKey: ['grades'] });
            }}
          />
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setForm(initialForm); setEditingGrade(null); }}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Série
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Nova Série</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Série *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Pré 1, 5º ano, Turma Especial"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_order">Ordem de Exibição</Label>
                <Input
                  id="display_order"
                  type="number"
                  min="0"
                  value={form.display_order}
                  onChange={(e) => setForm({ ...form, display_order: e.target.value })}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Números menores aparecem primeiro na lista
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={createGrade.isPending}>
                {createGrade.isPending ? 'Cadastrando...' : 'Cadastrar Série'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
          </div>
        ) : grades?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma série cadastrada
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Ordem</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grades?.map((grade) => (
                  <TableRow key={grade.id}>
                    <TableCell className="text-xs md:text-sm">
                      <div className="flex items-center gap-1">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span>{grade.display_order}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-xs md:text-sm">{grade.name}</TableCell>
                    <TableCell>
                      <Switch
                        checked={grade.is_active}
                        onCheckedChange={(checked) =>
                          toggleActive.mutate({ id: grade.id, isActive: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 md:h-8 md:w-8"
                          onClick={() => openEdit(grade)}
                        >
                          <Pencil className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-7 w-7 md:h-8 md:w-8"
                          onClick={() => {
                            if (confirm('Tem certeza que deseja excluir esta série?')) {
                              deleteGrade.mutate(grade.id);
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

        {/* Edit Dialog */}
        <Dialog open={!!editingGrade} onOpenChange={(open) => !open && setEditingGrade(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Série</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome da Série *</Label>
                <Input
                  id="edit-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Pré 1, 5º ano"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-display_order">Ordem de Exibição</Label>
                <Input
                  id="edit-display_order"
                  type="number"
                  min="0"
                  value={form.display_order}
                  onChange={(e) => setForm({ ...form, display_order: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={updateGrade.isPending}>
                {updateGrade.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default GradesManagement;
