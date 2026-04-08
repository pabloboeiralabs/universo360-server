import { useState, useEffect } from "react";
import { Download, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo-universo360.png";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallApp = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8">
        <img src={logo} alt="Universo 360°" className="h-20 mx-auto" />
        <h1 className="text-2xl font-bold">Instale o Universo 360°</h1>

        {isInstalled ? (
          <p className="text-muted-foreground">✅ App já está instalado! Abra pela tela inicial do seu dispositivo.</p>
        ) : isIOS ? (
          <div className="space-y-4 text-muted-foreground">
            <p>Para instalar no iPhone/iPad:</p>
            <ol className="text-left space-y-3 text-sm">
              <li className="flex gap-3 items-start">
                <Share className="w-5 h-5 shrink-0 text-primary mt-0.5" />
                <span>Toque no botão <strong>Compartilhar</strong> na barra do Safari</span>
              </li>
              <li className="flex gap-3 items-start">
                <Download className="w-5 h-5 shrink-0 text-primary mt-0.5" />
                <span>Selecione <strong>"Adicionar à Tela de Início"</strong></span>
              </li>
              <li className="flex gap-3 items-start">
                <Smartphone className="w-5 h-5 shrink-0 text-primary mt-0.5" />
                <span>Pronto! O app aparecerá na sua tela inicial</span>
              </li>
            </ol>
          </div>
        ) : deferredPrompt ? (
          <Button onClick={handleInstall} size="lg" className="rounded-full gap-2">
            <Download className="w-5 h-5" />
            Instalar App
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm">
            Abra este site no navegador Chrome do seu celular para instalar o app.
          </p>
        )}

        <a href="/" className="block text-sm text-primary hover:underline">
          ← Voltar ao site
        </a>
      </div>
    </div>
  );
};

export default InstallApp;
