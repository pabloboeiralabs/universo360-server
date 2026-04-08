import { NavLink } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SidebarMenuItemProps {
  title: string;
  icon: LucideIcon;
  path: string;
  collapsed: boolean;
  end?: boolean;
}

const SidebarMenuItem = ({ title, icon: Icon, path, collapsed, end = false }: SidebarMenuItemProps) => {
  const linkContent = (
    <NavLink
      to={path}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center transition-all duration-200",
          collapsed
            ? "justify-center w-10 h-10 mx-auto rounded-lg hover:bg-sidebar-accent"
            : "gap-3 px-3 py-2.5",
          isActive && !collapsed
            ? "sidebar-active-item bg-background text-primary font-semibold relative z-10"
            : isActive && collapsed
            ? "bg-background text-primary rounded-lg"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground rounded-lg hover:bg-sidebar-accent"
        )
      }
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!collapsed && <span className="text-sm font-medium">{title}</span>}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {linkContent}
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-popover text-popover-foreground border border-border shadow-md">
          {title}
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
};

export default SidebarMenuItem;
