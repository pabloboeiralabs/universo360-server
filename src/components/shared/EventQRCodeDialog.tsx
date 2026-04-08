import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EventQRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  schoolName: string;
  eventDate: string;
}

const EventQRCodeDialog = ({ open, onOpenChange, eventId, schoolName, eventDate }: EventQRCodeDialogProps) => {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const purchaseUrl = `${window.location.origin}/comprar/${eventId}`;

  useEffect(() => {
    if (!open || !eventId) return;
    QRCode.toDataURL(purchaseUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(setQrDataUrl).catch(() => toast.error('Erro ao gerar QR Code'));
  }, [open, eventId, purchaseUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(purchaseUrl);
    toast.success('Link copiado!');
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `qrcode-${schoolName.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = qrDataUrl;
    link.click();
    toast.success('QR Code baixado!');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const dateFormatted = format(parseISO(eventDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>QR Code - ${schoolName}</title>
      <style>
        body { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; margin:0; font-family:system-ui,sans-serif; }
        img { width:300px; height:300px; }
        h2 { margin:16px 0 4px; font-size:20px; }
        p { margin:0; color:#666; font-size:14px; }
        .url { margin-top:12px; font-size:11px; color:#999; word-break:break-all; max-width:320px; text-align:center; }
      </style></head><body>
        <img src="${qrDataUrl}" />
        <h2>${schoolName}</h2>
        <p>${dateFormatted}</p>
        <p class="url">${purchaseUrl}</p>
        <script>window.onload=()=>{window.print();window.close()}</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  const dateFormatted = eventDate
    ? format(parseISO(eventDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code de Compra</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="w-64 h-64 rounded-lg border" />
          ) : (
            <div className="w-64 h-64 rounded-lg border bg-muted animate-pulse" />
          )}
          <div className="text-center">
            <p className="font-semibold text-foreground">{schoolName}</p>
            <p className="text-sm text-muted-foreground">{dateFormatted}</p>
          </div>
          <p className="text-xs text-muted-foreground text-center break-all max-w-xs">{purchaseUrl}</p>
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={handleCopyLink}>
              <Copy className="h-4 w-4 mr-2" /> Copiar Link
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" /> Baixar
            </Button>
            <Button className="flex-1" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" /> Imprimir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EventQRCodeDialog;
