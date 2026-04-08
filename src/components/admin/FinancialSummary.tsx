import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface FinancialSummaryProps {
  gross: number;
  fees: number;
  net: number;
}

const FinancialSummary = ({ gross, fees, net }: FinancialSummaryProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 p-2 sm:p-4 bg-card rounded-lg border border-border">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/20">
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Bruto</p>
          <p className="text-xs sm:text-lg font-bold text-foreground">{formatCurrency(gross)}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-destructive/20">
          <TrendingDown className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Taxas (Est.)</p>
          <p className="text-xs sm:text-lg font-bold text-destructive">{formatCurrency(fees)}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/20">
          <DollarSign className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Líquido Estimado</p>
          <p className="text-xs sm:text-lg font-bold text-primary">{formatCurrency(net)}</p>
        </div>
      </div>
    </div>
  );
};

export default FinancialSummary;
