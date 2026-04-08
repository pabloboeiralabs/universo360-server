import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface SubItem {
  title: string;
  path: string;
}

interface SidebarAccordionProps {
  title: string;
  icon: LucideIcon;
  children: SubItem[];
  collapsed: boolean;
}

const SidebarAccordion = ({ title, icon: Icon, children, collapsed }: SidebarAccordionProps) => {
  const location = useLocation();
  const isChildActive = children.some(child => location.pathname === child.path);
  const [isOpen, setIsOpen] = useState(isChildActive);

  // Collapsed state - show popover with subitems
  if (collapsed) {
    return (
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200",
                  "hover:bg-sidebar-accent",
                  isChildActive
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-popover text-popover-foreground border border-border shadow-md">
            {title}
          </TooltipContent>
        </Tooltip>
        <PopoverContent 
          side="right" 
          align="start" 
          sideOffset={8}
          className="w-48 p-2 bg-popover text-popover-foreground border border-border shadow-lg rounded-lg"
        >
          <div className="space-y-1">
            <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            {children.map((child) => (
              <NavLink
                key={child.path}
                to={child.path}
                className={({ isActive }) =>
                  cn(
                    "flex items-center px-2 py-2 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/70 hover:text-foreground hover:bg-accent"
                  )
                }
              >
                {child.title}
              </NavLink>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Expanded state - show collapsible accordion
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition-all duration-200",
            "hover:bg-sidebar-accent",
            isChildActive
              ? "text-primary"
              : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
          )}
        >
          <div className="flex items-center gap-3">
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm font-medium">{title}</span>
          </div>
          <ChevronDown 
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isOpen && "rotate-180"
            )} 
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
        <div className="ml-4 mt-1 pl-4 border-l-2 border-sidebar-border/50 space-y-1">
          {children.map((child) => (
            <NavLink
              key={child.path}
              to={child.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )
              }
            >
              {child.title}
            </NavLink>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default SidebarAccordion;
