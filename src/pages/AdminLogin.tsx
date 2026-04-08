import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Rocket, User, Lock, Eye, EyeOff, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import cosmicBg from '@/assets/cosmic-bg.jpg';

const loginSchema = z.object({
  username: z.string().min(1, 'Usuário é obrigatório'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const AdminLogin = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsSubmitting(true);
    
    try {
      // First, lookup the username in profiles to get the associated email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', data.username)
        .maybeSingle();

      let email: string;

      if (profile) {
        // Found username in profiles, get the user's email from auth
        // Since we can't directly query auth.users, we use the internal email pattern
        // For franchises: username@franchise.universo360.local
        // For admin: we need to check if it's the admin username
        
        if (data.username === 'admin') {
          // Admin uses their real email - lookup from auth
          const { data: authUser } = await supabase.auth.admin?.getUserById?.(profile.id) || {};
          if (authUser?.user?.email) {
            email = authUser.user.email;
          } else {
            // Fallback: try with common admin email pattern
            email = 'pablo.boeira.pb@gmail.com'; // Known admin email
          }
      } else {
        // Franchise users use the internal email pattern
        email = `${data.username}@franchise.universo360.local`;
      }
    } else {
      // No profile found with username, try as internal franchise email
      email = `${data.username}@franchise.universo360.local`;
    }

    const collaboratorEmail = `${data.username}@collaborator.universo360.local`;

      // Try authentication with the resolved email
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: data.password,
      });

      // If franchise login fails, try collaborator email
      if (authError) {
        const { data: collabAuth, error: collabError } = await supabase.auth.signInWithPassword({
          email: collaboratorEmail,
          password: data.password,
        });

        if (!collabError && collabAuth.user) {
          await handleSuccessfulLogin(collabAuth.user.id);
          return;
        }
      }

      // If first attempt fails and username is 'admin', try known admin email
      if (authError && data.username === 'admin') {
        const { data: adminAuth, error: adminError } = await supabase.auth.signInWithPassword({
          email: 'pablo.boeira.pb@gmail.com',
          password: data.password,
        });
        
        if (adminError) {
          throw adminError;
        }
        
        // Successfully authenticated as admin
        if (adminAuth.user) {
          await handleSuccessfulLogin(adminAuth.user.id);
          return;
        }
      }

      if (authError) {
        throw authError;
      }

      if (authData.user) {
        await handleSuccessfulLogin(authData.user.id);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: 'Erro ao entrar',
        description: error.message === 'Invalid login credentials' 
          ? 'Usuário ou senha incorretos' 
          : error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessfulLogin = async (userId: string) => {
    try {
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      const roleList = userRoles?.map(r => r.role) || [];
      
      const delay = () => new Promise(r => setTimeout(r, 150));

      if (roleList.includes('admin')) {
        toast({
          title: 'Bem-vindo, Admin!',
          description: 'Redirecionando para o painel...',
        });
        await delay();
        window.location.replace('/admin');
      } else if (roleList.includes('franchise_owner')) {
        toast({
          title: 'Bem-vindo!',
          description: 'Redirecionando para seu painel...',
        });
        await delay();
        window.location.replace('/franchise');
      } else if (roleList.includes('collaborator')) {
        toast({
          title: 'Bem-vindo!',
          description: 'Redirecionando para seu painel...',
        });
        await delay();
        window.location.replace('/colaborador');
      } else {
        toast({
          title: 'Acesso negado',
          description: 'Você não tem permissão para acessar esta área.',
          variant: 'destructive',
        });
        await supabase.auth.signOut();
      }
    } catch (error: any) {
      console.error('Error in handleSuccessfulLogin:', error);
      toast({
        title: 'Erro ao redirecionar',
        description: 'Ocorreu um erro após o login. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center relative"
      style={{
        backgroundImage: `url(${cosmicBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Rocket className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold">Planetário</span>
        </Link>

        {/* Admin Badge */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <Shield className="w-5 h-5 text-primary" />
          <span className="text-sm text-muted-foreground">Admin · Franquia · Colaborador</span>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <h1 className="text-2xl font-bold text-center mb-6">
            Acesso ao Painel
          </h1>

          <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="admin"
                  className="pl-10"
                  {...form.register('username')}
                />
              </div>
              {form.formState.errors.username && (
                <p className="text-sm text-destructive">{form.formState.errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  {...form.register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => navigate('/')}
            >
              ← Voltar ao site
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;