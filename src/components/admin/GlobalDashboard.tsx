import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import KPICard from "./KPICard";
import YearTimeline from "./YearTimeline";
import MonthSelector from "./MonthSelector";
import {
  Building2, 
  Calendar, 
  Ticket, 
  DollarSign, 
  Users,
  PieChart,
  Star,
  Rocket
} from "lucide-react";
import { toast } from "sonner";

interface GlobalStats {
  total_franchises: number;
  total_events: number;
  total_tickets: number;
  total_revenue: number;
  total_students: number;
}

interface MatrizStats {
  revenue: number;
  tickets: number;
  students: number;
}

interface FranchiseRevenue {
  franchise_id: string;
  franchise_name: string;
  revenue: number;
  tickets: number;
  isMatriz: boolean;
}

export const GlobalDashboard = () => {
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [stats, setStats] = useState<GlobalStats>({
    total_franchises: 0,
    total_events: 0,
    total_tickets: 0,
    total_revenue: 0,
    total_students: 0,
  });
  const [matrizStats, setMatrizStats] = useState<MatrizStats>({
    revenue: 0,
    tickets: 0,
    students: 0,
  });
  const [franchiseRevenue, setFranchiseRevenue] = useState<FranchiseRevenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchGlobalStats();
  }, [selectedYear, selectedMonth, user?.id]);

  const fetchGlobalStats = async () => {
    setIsLoading(true);
    try {
      const startDate = new Date(selectedYear, selectedMonth, 1);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0);

      // Fetch the admin's Matriz franchise
      let matrizFranchiseId: string | null = null;
      if (user?.id) {
        const { data: matrizFranchise } = await supabase
          .from("franchises")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();
        
        matrizFranchiseId = matrizFranchise?.id || null;
      }

      // Fetch franchises count (excluding Matriz from count)
      const { data: franchises } = await supabase
        .from("franchises")
        .select("id")
        .eq("is_active", true);

      const franchisesCount = franchises?.filter(f => f.id !== matrizFranchiseId).length || 0;

      // Fetch events count
      const { count: eventsCount } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Fetch tickets with revenue for selected period
      const { data: tickets } = await supabase
        .from("tickets")
        .select(`
          id,
          amount,
          quantity,
          payment_status,
          franchise_id,
          created_at,
          franchises (
            id,
            name,
            owner_id
          )
        `)
        .eq("payment_status", "approved")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      const totalRevenue = tickets?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const totalStudents = tickets?.reduce((sum, t) => sum + t.quantity, 0) || 0;

      // Group by franchise and separate Matriz
      const revenueByFranchise: Record<string, FranchiseRevenue> = {};
      let matrizRevenue = 0;
      let matrizTickets = 0;
      let matrizStudents = 0;

      tickets?.forEach((ticket) => {
        const franchise = ticket.franchises as any;
        if (franchise) {
          const isMatriz = franchise.id === matrizFranchiseId;
          
          if (isMatriz) {
            matrizRevenue += Number(ticket.amount);
            matrizTickets += 1;
            matrizStudents += ticket.quantity;
          }
          
          if (!revenueByFranchise[franchise.id]) {
            revenueByFranchise[franchise.id] = {
              franchise_id: franchise.id,
              franchise_name: isMatriz ? "🚀 Matriz (Meu Planetário)" : franchise.name,
              revenue: 0,
              tickets: 0,
              isMatriz,
            };
          }
          revenueByFranchise[franchise.id].revenue += Number(ticket.amount);
          revenueByFranchise[franchise.id].tickets += ticket.quantity;
        }
      });

      setStats({
        total_franchises: franchisesCount,
        total_events: eventsCount || 0,
        total_tickets: tickets?.length || 0,
        total_revenue: totalRevenue,
        total_students: totalStudents,
      });

      setMatrizStats({
        revenue: matrizRevenue,
        tickets: matrizTickets,
        students: matrizStudents,
      });

      // Sort with Matriz first, then by revenue
      setFranchiseRevenue(
        Object.values(revenueByFranchise).sort((a, b) => {
          if (a.isMatriz) return -1;
          if (b.isMatriz) return 1;
          return b.revenue - a.revenue;
        })
      );

    } catch (error) {
      console.error("Error fetching global stats:", error);
      toast.error("Erro ao carregar estatísticas");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const franchisesRevenue = stats.total_revenue - matrizStats.revenue;

  return (
    <div className="p-2 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-lg md:text-2xl font-bold text-foreground">Dashboard Global</h1>
        <p className="text-sm text-muted-foreground">Visão consolidada de todas as franquias</p>
      </div>

      {/* Matriz Highlight Card */}
      {matrizStats.revenue > 0 && (
        <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Rocket className="h-5 w-5" />
              Meu Planetário (Matriz)
            </CardTitle>
            <CardDescription>Vendas diretas da sua operação no período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-1.5 md:gap-4">
              <div className="flex items-center gap-1.5 md:gap-3 p-2 md:p-3 bg-background/50 rounded-lg">
              <DollarSign className="h-4 w-4 md:h-8 md:w-8 text-green-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Receita</p>
                  <p className="text-xs sm:text-sm md:text-xl font-bold text-green-600 truncate">{formatCurrency(matrizStats.revenue)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 md:gap-3 p-2 md:p-3 bg-background/50 rounded-lg">
                <Ticket className="h-4 w-4 md:h-8 md:w-8 text-blue-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Ingressos</p>
                  <p className="text-xs sm:text-sm md:text-xl font-bold">{matrizStats.tickets}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 md:gap-3 p-2 md:p-3 bg-background/50 rounded-lg">
                <Users className="h-4 w-4 md:h-8 md:w-8 text-purple-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Alunos</p>
                  <p className="text-xs sm:text-sm md:text-xl font-bold">{matrizStats.students}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs de estrutura */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <KPICard
          title="Franquias"
          value={stats.total_franchises.toString()}
          subtitle="Parceiras"
          icon={Building2}
        />
        <KPICard
          title="Eventos"
          value={stats.total_events.toString()}
          subtitle="Ativos"
          icon={Calendar}
        />
        <KPICard
          title="Alunos"
          value={stats.total_students.toString()}
          subtitle="No período"
          icon={Users}
          variant="success"
        />
        <KPICard
          title="Receita Total"
          value={formatCurrency(stats.total_revenue)}
          subtitle="Todas as franquias"
          icon={DollarSign}
          variant="success"
        />
      </div>

      {/* Timeline */}
      <YearTimeline selectedYear={selectedYear} onYearChange={setSelectedYear} />
      <MonthSelector
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
      />

      {/* Revenue by Franchise */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Receita por Origem
          </CardTitle>
          <CardDescription>
            Comparativo entre Matriz e Franquias parceiras
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : franchiseRevenue.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma venda no período selecionado
            </p>
          ) : (
            <div className="space-y-4">
              {franchiseRevenue.map((franchise) => {
                const percentage = stats.total_revenue > 0 
                  ? (franchise.revenue / stats.total_revenue) * 100 
                  : 0;
                return (
                  <div 
                    key={franchise.franchise_id} 
                    className={`space-y-2 p-3 rounded-lg ${
                      franchise.isMatriz 
                        ? 'bg-primary/5 border border-primary/20' 
                        : ''
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-sm truncate">{franchise.franchise_name}</span>
                        {franchise.isMatriz && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            <Star className="h-3 w-3 mr-1" />
                            Sua operação
                          </Badge>
                        )}
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <span className="font-semibold text-sm">
                          {formatCurrency(franchise.revenue)}
                        </span>
                        <span className="text-muted-foreground text-xs ml-1">
                          ({franchise.tickets} ing.)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`rounded-full h-2 transition-all ${
                          franchise.isMatriz ? 'bg-green-500' : 'bg-primary'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Summary */}
              {franchiseRevenue.length > 1 && matrizStats.revenue > 0 && (
                  <div className="mt-6 pt-4 border-t grid grid-cols-2 gap-2 md:gap-4">
                  <div className="p-2 md:p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Matriz</p>
                    <p className="text-xs sm:text-sm md:text-lg font-bold text-green-600 truncate">
                      {formatCurrency(matrizStats.revenue)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {((matrizStats.revenue / stats.total_revenue) * 100).toFixed(1)}% do total
                    </p>
                  </div>
                  <div className="p-2 md:p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Franquias</p>
                    <p className="text-xs sm:text-sm md:text-lg font-bold text-blue-600 truncate">
                      {formatCurrency(franchisesRevenue)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {((franchisesRevenue / stats.total_revenue) * 100).toFixed(1)}% do total
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};