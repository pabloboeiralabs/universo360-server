import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Percent, Save } from 'lucide-react';
import { toast } from 'sonner';

interface CommissionDefaultsSettingsProps {
  franchiseId: string;
}

interface FranchiseDefaults {
  default_seller_commission_pct: number | null;
  default_presenter_commission_pct: number | null;
  default_supervisor_commission_pct: number | null;
  default_school_commission_pct: number | null;
}

const CommissionDefaultsSettings = ({ franchiseId }: CommissionDefaultsSettingsProps) => {
  const queryClient = useQueryClient();

  const [seller, setSeller] = useState('25');
  const [presenter, setPresenter] = useState('20');
  const [supervisor, setSupervisor] = useState('0');
  const [school, setSchool] = useState('10');

  const { data: franchise, isLoading } = useQuery({
    queryKey: ['franchise-commission-defaults', franchiseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('franchises')
        .select('default_seller_commission_pct, default_presenter_commission_pct, default_supervisor_commission_pct, default_school_commission_pct')
        .eq('id', franchiseId)
        .single();
      if (error) throw error;
      return data as FranchiseDefaults;
    },
  });

  useEffect(() => {
    if (franchise) {
      setSeller(String(franchise.default_seller_commission_pct ?? 25));
      setPresenter(String(franchise.default_presenter_commission_pct ?? 20));
      setSupervisor(String(franchise.default_supervisor_commission_pct ?? 0));
      setSchool(String(franchise.default_school_commission_pct ?? 10));
    }
  }, [franchise]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('franchises')
        .update({
          default_seller_commission_pct: parseFloat(seller) || 0,
          default_presenter_commission_pct: parseFloat(presenter) || 0,
          default_supervisor_commission_pct: parseFloat(supervisor) || 0,
          default_school_commission_pct: parseFloat(school) || 0,
        } as any)
        .eq('id', franchiseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['franchise-commission-defaults', franchiseId] });
      queryClient.invalidateQueries({ queryKey: ['franchise-defaults', franchiseId] });
      toast.success('Percentuais padrão salvos com sucesso!');
    },
    onError: (err: any) => toast.error('Erro ao salvar: ' + err.message),
  });

  const clamp = (val: string) => {
    const n = parseFloat(val);
    if (isNaN(n)) return val;
    return String(Math.min(100, Math.max(0, n)));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="h-5 w-5" />
          Percentuais Padrão de Comissão
        </CardTitle>
        <CardDescription>
          Esses percentuais serão usados automaticamente ao criar novos eventos. Cada evento ainda pode ser ajustado individualmente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg">
          {/* Vendedor */}
          <div className="space-y-2">
            <Label htmlFor="default_seller">% Vendedor</Label>
            <div className="relative">
              <Input
                id="default_seller"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={seller}
                onChange={e => setSeller(e.target.value)}
                onBlur={e => setSeller(clamp(e.target.value))}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>

          {/* Apresentador */}
          <div className="space-y-2">
            <Label htmlFor="default_presenter">% Apresentador</Label>
            <div className="relative">
              <Input
                id="default_presenter"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={presenter}
                onChange={e => setPresenter(e.target.value)}
                onBlur={e => setPresenter(clamp(e.target.value))}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>

          {/* Supervisor */}
          <div className="space-y-2">
            <Label htmlFor="default_supervisor">% Supervisor</Label>
            <div className="relative">
              <Input
                id="default_supervisor"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={supervisor}
                onChange={e => setSupervisor(e.target.value)}
                onBlur={e => setSupervisor(clamp(e.target.value))}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>

          {/* Escola */}
          <div className="space-y-2">
            <Label htmlFor="default_school">% Escola</Label>
            <div className="relative">
              <Input
                id="default_school"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={school}
                onChange={e => setSchool(e.target.value)}
                onBlur={e => setSchool(clamp(e.target.value))}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 rounded-lg bg-muted/50 border text-sm text-muted-foreground max-w-lg">
          <p className="font-medium text-foreground mb-1">Como funciona o cálculo</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>A comissão da Escola é deduzida primeiro sobre o valor bruto.</li>
            <li>O restante (Bruto − Escola) é a base para Vendedor, Apresentador e Supervisor.</li>
            <li>O Lucro Líquido é o que sobra após todas as deduções.</li>
          </ol>
        </div>

        <Button
          className="mt-6"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Salvando...' : 'Salvar Percentuais'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default CommissionDefaultsSettings;
