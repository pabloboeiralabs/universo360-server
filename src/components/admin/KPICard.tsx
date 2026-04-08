import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const KPICard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon,
  trend,
  trendValue,
  variant = 'default'
}: KPICardProps) => {
  const variantStyles = {
    default: 'text-primary',
    success: 'text-primary',
    warning: 'text-yellow-500',
    danger: 'text-destructive'
  };

  const trendStyles = {
    up: 'text-primary',
    down: 'text-destructive',
    neutral: 'text-muted-foreground'
  };

  return (
    <Card className="p-3 md:p-6 bg-card border-border hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between">
        <div className="space-y-1 md:space-y-2">
          <p className="text-xs md:text-sm font-medium text-muted-foreground">{title}</p>
          <p className={cn("text-base md:text-3xl font-bold", variantStyles[variant])}>{value}</p>
          {subtitle && (
            <p className="text-xs md:text-sm text-muted-foreground">{subtitle}</p>
          )}
          {trend && trendValue && (
            <p className={cn("text-xs font-medium", trendStyles[trend])}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
            </p>
          )}
        </div>
        <div className="p-2 md:p-3 rounded-xl bg-muted">
          <Icon className={cn("h-5 w-5 md:h-6 md:w-6", variantStyles[variant])} />
        </div>
      </div>
    </Card>
  );
};

export default KPICard;
