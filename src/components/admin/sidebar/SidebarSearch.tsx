import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SidebarSearchProps {
  collapsed: boolean;
}

const SidebarSearch = ({ collapsed }: SidebarSearchProps) => {
  if (collapsed) {
    return (
      <div className="flex justify-center py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <Search className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-popover text-popover-foreground border border-border shadow-md">
            Buscar
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sidebar-foreground/40" />
        <Input
          placeholder="Buscar..."
          className={cn(
            "pl-9 pr-10 h-10 bg-sidebar-accent/50 border-sidebar-border",
            "placeholder:text-sidebar-foreground/40 text-sidebar-foreground",
            "focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500/50",
            "rounded-lg"
          )}
        />
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-sidebar-foreground/40 hover:text-sidebar-foreground"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default SidebarSearch;
