import { useState, useEffect, useRef } from 'react';
import { Check, Copy, Clock, Loader2, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface PixQRCodeProps {
  qrCode: string;
  qrCodeBase64: string;
  ticketId: string;
  expirationDate: string;
  onPaymentConfirmed: () => void;
}

const PixQRCode = ({
  qrCode,
  qrCodeBase64,
  ticketId,
  expirationDate,
  onPaymentConfirmed,
}: PixQRCodeProps) => {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const confirmedRef = useRef(false);

  // Confirm payment once (avoid double-call)
  const confirmOnce = () => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    onPaymentConfirmed();
  };

  // Countdown timer
  useEffect(() => {
    const calculateTimeLeft = () => {
      const expiration = new Date(expirationDate);
      const now = new Date();
      const diff = expiration.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Expirado');
        setIsExpired(true);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [expirationDate]);

  // ── PRIMARY: Realtime subscription on the ticket row ──────────────────
  useEffect(() => {
    if (!ticketId) return;

    const channel = supabase
      .channel(`ticket-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets',
          filter: `id=eq.${ticketId}`,
        },
        (payload) => {
          console.log('Realtime ticket update:', payload.new);
          if ((payload.new as any)?.payment_status === 'approved') {
            confirmOnce();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  // ── FALLBACK: Poll every 15s in case webhook/realtime misses ─────────
  useEffect(() => {
    if (isExpired) return;

    const checkPaymentStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-payment-status', {
          body: { ticket_id: ticketId },
        });
        if (error) return;
        console.log('Fallback poll status:', data?.payment_status);
        if (data?.payment_status === 'approved') {
          confirmOnce();
        }
      } catch (err) {
        console.error('Fallback poll error:', err);
      }
    };

    // First check after 5s, then every 15s
    const timeout = setTimeout(checkPaymentStatus, 5000);
    const interval = setInterval(checkPaymentStatus, 15000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [isExpired, ticketId]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrCode);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Erro ao copiar código');
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Pagamento via PIX
        </CardTitle>
        <CardDescription>
          Escaneie o QR Code ou copie o código para pagar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* QR Code Image */}
        <div className="flex justify-center">
        <div className="bg-background border p-4 rounded-lg shadow-inner">
            <img
              src={qrCodeBase64.startsWith('data:') ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`}
              alt="PIX QR Code"
              className="w-48 h-48"
            />
          </div>
        </div>

        {/* Copy Button */}
        <Button
          onClick={handleCopy}
          variant="outline"
          className="w-full"
          disabled={isExpired}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2 text-primary" />
              Código copiado!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copiar código PIX
            </>
          )}
        </Button>

        {/* Timer */}
        <div className="flex items-center justify-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {isExpired ? (
              <span className="text-destructive">Código expirado</span>
            ) : (
              <>Expira em: <span className="font-mono font-bold">{timeLeft}</span></>
            )}
          </span>
        </div>

        {/* Status */}
        {!isExpired && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Wifi className="h-4 w-4 text-primary" />
            Aguardando confirmação em tempo real...
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PixQRCode;
