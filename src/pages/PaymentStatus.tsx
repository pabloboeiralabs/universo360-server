import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, Home, PartyPopper, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const PaymentStatus = () => {
  const [searchParams] = useSearchParams();
  const [isChecking, setIsChecking] = useState(false);
  const [checkCount, setCheckCount] = useState(0);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  
  const status = searchParams.get('status');
  const paymentId = searchParams.get('payment_id');
  const ticketId = searchParams.get('ticket') || searchParams.get('ticket_id');
  const externalReference = searchParams.get('external_reference');
  const isFreeTicket = searchParams.get('type') === 'free';

  // Use currentStatus if available, otherwise fall back to URL param
  const displayStatus = currentStatus || status;

  const getStatusConfig = () => {
    // Free ticket success
    if (isFreeTicket && displayStatus === 'approved') {
      return {
        icon: PartyPopper,
        iconColor: 'text-green-500',
        bgColor: 'bg-green-500/10',
        title: 'Inscrição Confirmada!',
        description: 'Sua inscrição foi realizada com sucesso.',
        message: 'Você está inscrito no evento. Apresente-se no local na data marcada.',
      };
    }

    switch (displayStatus) {
      case 'approved':
      case 'success':
        return {
          icon: CheckCircle,
          iconColor: 'text-green-500',
          bgColor: 'bg-green-500/10',
          title: 'Parabéns!',
          description: 'A compra foi executada com sucesso.',
          message: 'O nome do(a) aluno(a) foi inserido na lista com sucesso.',
        };
      case 'pending':
        return {
          icon: Clock,
          iconColor: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          title: 'Verificando Pagamento...',
          description: 'Aguarde enquanto confirmamos o seu pagamento.',
          message: 'Estamos verificando o status do seu pagamento. Isso pode levar alguns instantes.',
          showLoader: true,
        };
      case 'failure':
      case 'rejected':
      default:
        return {
          icon: XCircle,
          iconColor: 'text-red-500',
          bgColor: 'bg-red-500/10',
          title: 'Pagamento Recusado',
          description: 'Não foi possível processar seu pagamento.',
          message: 'Por favor, tente novamente ou utilize outro método de pagamento.',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  // Function to check payment status
  const checkPaymentStatus = async () => {
    if (!ticketId || isFreeTicket) return;
    
    setIsChecking(true);
    try {
      console.log('Checking payment status for ticket:', ticketId);
      
      const { data, error } = await supabase.functions.invoke('check-payment-status', {
        body: { ticket_id: ticketId },
      });

      if (error) {
        console.error('Error checking payment status:', error);
        return;
      }

      console.log('Payment status response:', data);

      if (data?.payment_status) {
        // Map status
        let mappedStatus = data.payment_status;
        if (mappedStatus === 'approved') {
          mappedStatus = 'approved';
        } else if (mappedStatus === 'rejected' || mappedStatus === 'cancelled') {
          mappedStatus = 'failure';
        }
        
        setCurrentStatus(mappedStatus);

        // If approved, stop checking
        if (mappedStatus === 'approved') {
          setCheckCount(999); // Stop polling
        }
      }
    } catch (err) {
      console.error('Error in checkPaymentStatus:', err);
    } finally {
      setIsChecking(false);
    }
  };

  // Initial check and polling
  useEffect(() => {
    // Log for debugging
    console.log('Payment status page loaded:', { status, paymentId, ticketId, externalReference, isFreeTicket });

    // Only poll for pending payments with a ticket ID
    if (!ticketId || isFreeTicket) return;
    
    // If status is success/approved from URL, still verify once
    if (status === 'success' || status === 'approved') {
      checkPaymentStatus();
      return;
    }

    // For pending status, start polling
    if (status === 'pending' || !status) {
      // Initial check
      checkPaymentStatus();

      // Poll every 3 seconds for up to 2 minutes (40 checks)
      const interval = setInterval(() => {
        setCheckCount((prev) => {
          if (prev >= 40) {
            clearInterval(interval);
            return prev;
          }
          checkPaymentStatus();
          return prev + 1;
        });
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [ticketId, status, isFreeTicket]);

  const handleManualCheck = () => {
    setCheckCount(0);
    checkPaymentStatus();
  };

  const showLoader = (config as any).showLoader && checkCount < 40;

  return (
    <div className="dark min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className={`mx-auto w-16 h-16 rounded-full ${config.bgColor} flex items-center justify-center mb-4`}>
            {showLoader ? (
              <Loader2 className={`h-8 w-8 ${config.iconColor} animate-spin`} />
            ) : (
              <Icon className={`h-8 w-8 ${config.iconColor}`} />
            )}
          </div>
          <CardTitle className="text-2xl">{config.title}</CardTitle>
          <CardDescription>{config.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground">{config.message}</p>
          
          {/* Show checking indicator */}
          {isChecking && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Verificando...</span>
            </div>
          )}

          {/* Timeout message */}
          {displayStatus === 'pending' && checkCount >= 40 && (
            <div className="bg-yellow-500/10 rounded-lg p-4 text-center">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                O pagamento ainda não foi confirmado. Se você já pagou, aguarde alguns minutos e verifique novamente.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={handleManualCheck}
                disabled={isChecking}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
                Verificar Novamente
              </Button>
            </div>
          )}

          {paymentId && !isFreeTicket && (
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">ID do pagamento</p>
              <p className="font-mono text-sm">{paymentId}</p>
            </div>
          )}

          {ticketId && (
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">
                {isFreeTicket ? 'Código da inscrição' : 'Código do ingresso'}
              </p>
              <p className="font-mono text-sm break-all">{ticketId}</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Button asChild className="w-full">
              <Link to="/">
                <Home className="h-4 w-4 mr-2" />
                Voltar ao Início
              </Link>
            </Button>
            {displayStatus !== 'approved' && displayStatus !== 'success' && (
              <Button variant="outline" asChild className="w-full">
                <Link to="/#tickets">Tentar Novamente</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentStatus;
