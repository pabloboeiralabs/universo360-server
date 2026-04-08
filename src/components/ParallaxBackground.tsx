import { ReactNode } from 'react';
import { useParallax } from '@/hooks/useParallax';

interface ParallaxBackgroundProps {
  children: ReactNode;
  imageSrc: string;
  speed?: number;
  overlay?: boolean;
  overlayClassName?: string;
  className?: string;
}

const ParallaxBackground = ({
  children,
  imageSrc,
  speed = 0.3,
  overlay = true,
  overlayClassName = 'bg-gradient-to-b from-background via-background/80 to-background',
  className,
}: ParallaxBackgroundProps) => {
  const offset = useParallax({ speed });

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Parallax Background */}
      <div
        className="absolute inset-0 bg-cover bg-center will-change-transform"
        style={{
          backgroundImage: `url(${imageSrc})`,
          transform: `translateY(${offset}px) scale(1.1)`,
        }}
      />
      
      {/* Overlay */}
      {overlay && <div className={`absolute inset-0 ${overlayClassName}`} />}
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default ParallaxBackground;
