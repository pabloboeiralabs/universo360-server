import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface RefundConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
  ticketInfo: {
    customerName: string;
    studentName?: string;
    amount: number;
    eventName?: string;
  } | null;
  isLoading: boolean;
}

const RefundConfirmDialog = ({
  open,
  onOpenChange,
  onConfirm,
  ticketInfo,
  isLoading,
}: RefundConfirmDialogProps) => {
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleConfirm = async () => {
    if (!confirmed || !reason.trim()) return;
    await onConfirm(reason);
    setReason('');
    setConfirmed(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen);
      if (!newOpen) {
        setReason('');
        setConfirmed(false);
      }
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Confirmar Estorno
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-4">
            <p>
              Você está prestes a estornar o pagamento de um ingresso. Esta ação
              <strong> não pode ser desfeita</strong>.
            </p>

            {ticketInfo && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-medium text-foreground">{ticketInfo.customerName}</span>
                </div>
                {ticketInfo.studentName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Aluno:</span>
                    <span className="font-medium text-foreground">{ticketInfo.studentName}</span>
                  </div>
                )}
                {ticketInfo.eventName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Evento:</span>
                    <span className="font-medium text-foreground">{ticketInfo.eventName}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="text-muted-foreground">Valor a estornar:</span>
                  <span className="font-bold text-destructive">
                    {formatCurrency(ticketInfo.amount)}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="refund-reason">Motivo do estorno *</Label>
              <Textarea
                id="refund-reason"
                placeholder="Descreva o motivo do estorno..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-[80px]"
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="confirm-refund"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
                disabled={isLoading}
              />
              <Label
                htmlFor="confirm-refund"
                className="text-sm font-normal cursor-pointer"
              >
                Entendo que esta ação é irreversível e o valor será devolvido ao cliente
              </Label>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!confirmed || !reason.trim() || isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              'Confirmar Estorno'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RefundConfirmDialog;
