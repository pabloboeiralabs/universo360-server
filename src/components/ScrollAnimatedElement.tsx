import { ReactNode } from 'react';
import { useScrollAnimation } from '@/hooks/useParallax';
import { cn } from '@/lib/utils';

interface ScrollAnimatedElementProps {
  children: ReactNode;
  animation?: 'fade-up' | 'fade-left' | 'fade-right' | 'scale' | 'fade';
  delay?: number;
  className?: string;
  threshold?: number;
}

const animations = {
  'fade-up': {
    hidden: 'opacity-0 translate-y-8',
    visible: 'opacity-100 translate-y-0',
  },
  'fade-left': {
    hidden: 'opacity-0 translate-x-8',
    visible: 'opacity-100 translate-x-0',
  },
  'fade-right': {
    hidden: 'opacity-0 -translate-x-8',
    visible: 'opacity-100 translate-x-0',
  },
  'scale': {
    hidden: 'opacity-0 scale-95',
    visible: 'opacity-100 scale-100',
  },
  'fade': {
    hidden: 'opacity-0',
    visible: 'opacity-100',
  },
};

const ScrollAnimatedElement = ({
  children,
  animation = 'fade-up',
  delay = 0,
  className,
  threshold = 0.1,
}: ScrollAnimatedElementProps) => {
  const { ref, isVisible } = useScrollAnimation({ threshold });
  const animationConfig = animations[animation];

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-700 ease-out',
        isVisible ? animationConfig.visible : animationConfig.hidden,
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

export default ScrollAnimatedElement;
