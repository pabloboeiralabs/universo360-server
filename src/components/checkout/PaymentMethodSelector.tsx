import { CreditCard, QrCode, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type PaymentMethod = 'card' | 'pix' | 'cash';

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod;
  onSelectMethod: (method: PaymentMethod) => void;
  showCash?: boolean;
}

const PaymentMethodSelector = ({ selectedMethod, onSelectMethod, showCash = false }: PaymentMethodSelectorProps) => {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Escolha a forma de pagamento:</p>
      <div className={cn("grid gap-3", showCash ? "grid-cols-3" : "grid-cols-2")}>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-24 flex flex-col items-center justify-center gap-2 transition-all",
            selectedMethod === 'card' && "border-primary bg-primary/5 ring-2 ring-primary"
          )}
          onClick={() => onSelectMethod('card')}
        >
          <CreditCard className={cn("h-8 w-8", selectedMethod === 'card' ? "text-primary" : "text-muted-foreground")} />
          <span className={cn("font-medium", selectedMethod === 'card' ? "text-primary" : "text-foreground")}>
            Cartão
          </span>
        </Button>
        
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-24 flex flex-col items-center justify-center gap-2 transition-all",
            selectedMethod === 'pix' && "border-primary bg-primary/5 ring-2 ring-primary"
          )}
          onClick={() => onSelectMethod('pix')}
        >
          <QrCode className={cn("h-8 w-8", selectedMethod === 'pix' ? "text-primary" : "text-muted-foreground")} />
          <span className={cn("font-medium", selectedMethod === 'pix' ? "text-primary" : "text-foreground")}>
            PIX
          </span>
        </Button>

        {showCash && (
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-24 flex flex-col items-center justify-center gap-2 transition-all",
              selectedMethod === 'cash' && "border-primary bg-primary/5 ring-2 ring-primary"
            )}
            onClick={() => onSelectMethod('cash')}
          >
            <Banknote className={cn("h-8 w-8", selectedMethod === 'cash' ? "text-primary" : "text-muted-foreground")} />
            <span className={cn("font-medium", selectedMethod === 'cash' ? "text-primary" : "text-foreground")}>
              Dinheiro
            </span>
          </Button>
        )}
      </div>
    </div>
  );
};

export default PaymentMethodSelector;
