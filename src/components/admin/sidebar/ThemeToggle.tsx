import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ThemeToggleProps {
  collapsed: boolean;
}

const ThemeToggle = ({ collapsed }: ThemeToggleProps) => {
  const { theme, setTheme } = useTheme();

  if (collapsed) {
    return (
      <div className="flex justify-center py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200",
                "hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground"
              )}
            >
              {theme === 'dark' ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-popover text-popover-foreground border border-border shadow-md">
            {theme === 'dark' ? 'Modo Escuro' : 'Modo Claro'}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="px-4 py-2">
      <div className="flex items-center bg-sidebar-accent/50 rounded-lg p-1">
        <button
          onClick={() => setTheme('light')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200",
            theme === 'light'
              ? "bg-background text-foreground shadow-sm"
              : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
          )}
        >
          <Sun className="h-4 w-4" />
          <span>Light</span>
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200",
            theme === 'dark'
              ? "bg-background text-foreground shadow-sm"
              : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
          )}
        >
          <Moon className="h-4 w-4" />
          <span>Dark</span>
        </button>
      </div>
    </div>
  );
};

export default ThemeToggle;
