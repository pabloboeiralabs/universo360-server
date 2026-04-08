import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SidebarSectionProps {
  label: string;
  collapsed: boolean;
  children: ReactNode;
}

const SidebarSection = ({ label, collapsed, children }: SidebarSectionProps) => {
  return (
    <div className={cn("py-2", collapsed && "py-1")}>
      {!collapsed && (
        <p className="px-4 mb-2 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
          {label}
        </p>
      )}
      {collapsed && (
        <div className="mx-3 mb-1 border-t border-sidebar-border/50" />
      )}
      <div className={cn(
        "flex flex-col overflow-visible",
        collapsed ? "items-center gap-1 px-0" : "gap-1 px-3"
      )}>
        {children}
      </div>
    </div>
  );
};

export default SidebarSection;
