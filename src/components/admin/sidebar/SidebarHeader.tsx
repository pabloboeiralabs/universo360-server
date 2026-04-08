import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SidebarHeaderProps {
  collapsed: boolean;
  onToggle: () => void;
  title?: string;
  subtitle?: string;
}

const SidebarHeader = ({ collapsed, onToggle, title = "Universo360", subtitle }: SidebarHeaderProps) => {
  return (
    <div className={cn(
      "flex items-center h-14 border-b border-sidebar-border relative",
      collapsed ? "justify-center px-2" : "justify-between px-4"
    )}>
      {!collapsed && (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">U</span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sidebar-foreground text-sm leading-tight">{title}</span>
            {subtitle && <span className="text-xs text-sidebar-foreground/50">{subtitle}</span>}
          </div>
        </div>
      )}
      
      {collapsed && (
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">U</span>
        </div>
      )}
      
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className={cn(
          "h-6 w-6 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent",
          collapsed && "absolute -right-3 top-4 z-50 rounded-full border border-border bg-background shadow-md"
        )}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </Button>
    </div>
  );
};

export default SidebarHeader;
