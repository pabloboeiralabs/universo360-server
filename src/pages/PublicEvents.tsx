import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar, MapPin, Users, Ticket, Loader2, ArrowLeft, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useMemo } from 'react';
import logoUniverso from '@/assets/logo-universo360.png';
import cosmicBg from '@/assets/cosmic-school-bg.png';

interface PublicEvent {
  id: string;
  school_name: string;
  event_date: string;
  event_time: string;
  price: number;
  total_capacity: number;
  available_spots: number;
  location: string;
  is_active: boolean;
}

const PublicEvents = () => {
  const [search, setSearch] = useState('');

  const { data: events, isLoading } = useQuery({
    queryKey: ['public-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, school_name, event_date, event_time, price, total_capacity, available_spots, location, is_active')
        .eq('is_active', true)
        .gte('event_date', new Date().toISOString().split('T')[0])
        .order('event_date', { ascending: true });

      if (error) throw error;
      return data as PublicEvent[];
    },
  });

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    if (!search.trim()) return events;
    const term = search.toLowerCase();
    return events.filter(
      (e) =>
        e.school_name.toLowerCase().includes(term) ||
        e.location.toLowerCase().includes(term)
    );
  }, [events, search]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <div className="dark min-h-screen text-foreground relative">
      {/* Cosmic Background */}
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${cosmicBg})` }}
      />
      <div className="fixed inset-0 -z-10 bg-background/70" />

      {/* Header */}
      <header className="border-b border-white/10 bg-background/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoUniverso} alt="Universo 360°" className="h-10" />
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm" className="text-foreground/80 hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao site
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 text-primary text-sm font-medium mb-4">
            <Ticket className="h-4 w-4" />
            Ingressos Disponíveis
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-3">Próximos Eventos</h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            Encontre a escola do seu filho e garanta o ingresso para a experiência no planetário
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-8 max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por escola ou local..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-background/50 border-white/10 backdrop-blur-sm"
          />
        </div>

        {/* Events List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-16">
            <Ticket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {search ? 'Nenhum evento encontrado' : 'Nenhum evento disponível'}
            </h3>
            <p className="text-muted-foreground">
              {search
                ? 'Tente buscar por outro nome de escola ou local.'
                : 'No momento não há eventos abertos. Volte em breve!'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredEvents.map((event) => {
              const soldOut = event.available_spots <= 0;
              const dateFormatted = format(parseISO(event.event_date), "dd 'de' MMMM", { locale: ptBR });
              const timeFormatted = event.event_time.slice(0, 5);

              return (
                <Card key={event.id} className="overflow-hidden bg-card/60 backdrop-blur-sm border-white/10 hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-primary/5">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-foreground text-lg leading-tight">
                        {event.school_name}
                      </h3>
                      {soldOut ? (
                        <Badge variant="secondary">Esgotado</Badge>
                      ) : (
                        <Badge className="bg-primary/20 text-primary border-primary/30">Disponível</Badge>
                      )}
                    </div>

                    <div className="space-y-2 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 shrink-0 text-primary" />
                        <span>{dateFormatted} às {timeFormatted}</span>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 shrink-0 text-primary" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 shrink-0 text-primary" />
                        <span>{event.available_spots} vagas restantes</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/10">
                      <span className="text-xl font-bold text-primary">
                        {event.price > 0 ? formatCurrency(event.price) : 'Gratuito'}
                      </span>
                      <Link to={`/comprar/${event.id}`}>
                        <Button disabled={soldOut} size="sm">
                          <Ticket className="h-4 w-4 mr-2" />
                          {soldOut ? 'Esgotado' : 'Comprar'}
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default PublicEvents;
