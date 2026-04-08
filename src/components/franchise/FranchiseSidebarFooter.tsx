import { LogOut, MoreVertical, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface FranchiseSidebarFooterProps {
  collapsed: boolean;
  isMPConnected?: boolean;
  onConnectMP?: () => void;
  isConnectingMP?: boolean;
}

const FranchiseSidebarFooter = ({ 
  collapsed, 
  isMPConnected = false,
  onConnectMP,
  isConnectingMP = false
}: FranchiseSidebarFooterProps) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const userInitials = user?.email?.substring(0, 2).toUpperCase() || 'FR';
  const userName = user?.email?.split('@')[0] || 'Franqueado';
  const userEmail = user?.email || 'franquia@email.com';

  if (collapsed) {
    return (
      <div className="px-2 py-3 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex justify-center h-11 items-center">
              <Avatar className="h-10 w-10 bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors cursor-pointer">
                <AvatarFallback className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-56 bg-popover border border-border">
            <div className="px-2 py-2 border-b border-border">
              <p className="text-sm font-medium text-foreground">{userName}</p>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            </div>
            <DropdownMenuItem 
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-t border-sidebar-border space-y-3">
      {/* MP Connection Status */}
      {isMPConnected ? (
        <Badge variant="outline" className="w-full justify-center border-green-500/50 text-green-600 bg-green-500/10 gap-1 py-1.5">
          <CheckCircle className="h-3 w-3" />
          MP Conectado
        </Badge>
      ) : onConnectMP && (
        <Button
          variant="outline"
          size="sm"
          className="w-full border-yellow-500/50 text-yellow-600 bg-yellow-500/10 hover:bg-yellow-500/20 gap-1"
          onClick={onConnectMP}
          disabled={isConnectingMP}
        >
          {isConnectingMP ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Conectando...
            </>
          ) : (
            <>
              <AlertCircle className="h-3 w-3" />
              Conectar MP
            </>
          )}
        </Button>
      )}

      {/* User Profile */}
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 bg-emerald-500/20">
          <AvatarFallback className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
            {userInitials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-sidebar-foreground truncate">
            {userName}
          </p>
          <p className="text-xs text-sidebar-foreground/60 truncate">
            Franqueado
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem 
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default FranchiseSidebarFooter;
