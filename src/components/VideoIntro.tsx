import { useState, useCallback, useRef, useEffect } from "react";
import { Play, X, GripHorizontal } from "lucide-react";

interface VideoIntroProps {
  onComplete: () => void;
  forceStart?: boolean;
  onForceHandled?: () => void;
}

const STORAGE_KEY = 'universo360_video_seen';

const VideoIntro = ({ onComplete, forceStart, onForceHandled }: VideoIntroProps) => {
  const alreadySeen = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true';

  const [started, setStarted] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [closed, setClosed] = useState(alreadySeen);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMinimize = useCallback(() => {
    setMinimized(true);
    setPosition({ x: 0, y: 0 });
    localStorage.setItem(STORAGE_KEY, 'true');
    onComplete();
  }, [onComplete]);

  const handleClose = useCallback(() => {
    setClosed(true);
    localStorage.setItem(STORAGE_KEY, 'true');
  }, []);


  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!minimized) return;
    setDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [minimized, position]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPosition({
      x: dragRef.current.posX + dx,
      y: dragRef.current.posY + dy,
    });
  }, [dragging]);

  const onPointerUp = useCallback(() => {
    setDragging(false);
    dragRef.current = null;
  }, []);

  // Handle forceStart from Hero play button
  useEffect(() => {
    if (forceStart) {
      setClosed(false);
      setStarted(true);
      setMinimized(false);
      onForceHandled?.();
    }
  }, [forceStart, onForceHandled]);

  if (alreadySeen && !forceStart && !started) {
    onComplete();
    return null;
  }

  if (closed) return null;

  return (
    <>
      {/* Full-screen overlay (only when not minimized and started) */}
      {!minimized && (
        <div
          className="fixed inset-0 z-[100] bg-background flex items-center justify-center"
          onClick={started ? handleMinimize : undefined}
        >
          {started && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
                onComplete();
              }}
              className="absolute top-6 right-6 text-foreground/90 hover:text-foreground transition-colors z-10"
              aria-label="Fechar vídeo"
            >
              <X className="w-6 h-6" />
            </button>
          )}

          {!started && (
            <button
              onClick={() => setStarted(true)}
              className="flex flex-col items-center gap-6 group cursor-pointer"
            >
              <h2 className="text-2xl md:text-3xl font-bold text-foreground text-gradient italic">
                Universo 360°
              </h2>
              <div className="w-24 h-24 rounded-full bg-primary/90 flex items-center justify-center glow-effect group-hover:scale-110 transition-transform">
                <Play className="w-10 h-10 text-primary-foreground ml-1" />
              </div>
              <p className="text-foreground/90 text-sm">Toque para iniciar</p>
            </button>
          )}

          {started && (
            <p className="absolute bottom-8 text-sm text-foreground/90 animate-pulse">
              Clique fora do vídeo para continuar navegando
            </p>
          )}
        </div>
      )}

      {/* Video container - always the same element, just repositioned */}
      {started && (
        <div
          ref={containerRef}
          className={`fixed z-[101] ${
            minimized
              ? "glass-card p-1.5 glow-effect rounded-xl shadow-lg select-none"
              : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 glass-card p-2 glow-effect rounded-2xl"
          }`}
          style={
            minimized
              ? {
                  bottom: `calc(1rem - ${position.y}px)`,
                  right: `calc(1rem - ${position.x}px)`,
                  transition: dragging ? "none" : "box-shadow 0.3s",
                }
              : undefined
          }
        >
          {/* Drag handle + Close button for minimized */}
          {minimized && (
            <>
              <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                className="flex items-center justify-center py-1 cursor-grab active:cursor-grabbing touch-none"
              >
                <GripHorizontal className="w-4 h-4 text-foreground/90" />
              </div>
              <button
                onClick={handleClose}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center text-foreground/90 hover:text-foreground transition-colors z-10"
                aria-label="Fechar vídeo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <div
            className={`overflow-hidden ${
              minimized ? "rounded-lg w-[140px] sm:w-[160px]" : "rounded-xl w-[280px] sm:w-[320px] md:w-[360px]"
            }`}
            style={{ aspectRatio: '9/16' }}
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src="https://www.youtube.com/embed/bjEeUgqMZog?autoplay=1"
              title="Universo 360"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default VideoIntro;
