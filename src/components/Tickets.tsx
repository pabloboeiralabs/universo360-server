import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Rocket, Calendar, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Event {
  id: string;
  school_name: string;
  location: string;
  event_date: string;
  event_time: string;
  price: number;
  available_spots: number;
  is_active: boolean;
}

const Tickets = () => {
  const { data: events, isLoading } = useQuery({
    queryKey: ['public-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, school_name, location, event_date, event_time, price, available_spots, is_active')
        .eq('is_active', true)
        .gt('available_spots', 0)
        .gte('event_date', new Date().toISOString().split('T')[0])
        .order('event_date', { ascending: true })
        .limit(6);

      if (error) throw error;
      return data as Event[];
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
  };

  return (
    <section
      id="tickets"
      className="relative py-20 overflow-hidden min-h-[600px]"
    >

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-2">
            Garanta seu <span className="text-gradient">Ingresso</span>
          </h2>
          <p className="text-foreground/90">
            Selecione abaixo a escola do seu filho(a) para continuar com a
            compra segura.
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!events || events.length === 0) && (
          <div className="text-center py-12">
            <Rocket className="h-12 w-12 mx-auto mb-4 text-foreground/90" />
            <p className="text-foreground/90">
              Nenhum evento disponível no momento.
            </p>
            <p className="text-sm text-foreground/90 mt-2">
              Volte em breve para conferir novas datas!
            </p>
          </div>
        )}

        {/* Tickets Grid */}
        {events && events.length > 0 && (
          <div className="flex justify-center gap-6 flex-wrap">
            {events.slice(0, 4).map((event, index) => (
              <div
                key={event.id}
                className="glass-card p-6 w-full max-w-sm space-y-4 transform hover:scale-105 transition-all duration-300"
                style={{
                  transform: `rotate(${index % 2 === 0 ? "-2deg" : "2deg"})`,
                }}
              >
                {/* Icon */}
                <div className="feature-icon mx-auto">
                  <Rocket className="w-6 h-6" />
                </div>

                {/* School Name */}
                <h3 className="font-semibold text-center text-lg border-b border-white/10 pb-4">
                  {event.school_name}
                </h3>

                {/* Details */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm text-foreground/90">
                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                    <span className="capitalize">{formatEventDate(event.event_date)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-foreground/90">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    {event.location}
                  </div>
                </div>

                {/* Price and CTA */}
                <div className="pt-4 space-y-3 border-t border-white/10">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-foreground/90 uppercase">
                      {event.price === 0 ? 'Entrada' : 'Valor do Ingresso'}
                    </span>
                    {event.price === 0 ? (
                      <span className="text-xl font-bold text-green-400 bg-green-500/20 px-3 py-1 rounded-full">
                        Gratuito
                      </span>
                    ) : (
                      <span className="text-2xl font-bold">{formatCurrency(event.price)}</span>
                    )}
                  </div>
                  <Button asChild className={`w-full ${event.price === 0 ? 'bg-green-500 hover:bg-green-600' : 'btn-primary'}`}>
                    <Link to={`/comprar/${event.id}`}>
                      {event.price === 0 ? 'Inscrever-se' : 'Comprar Agora'}
                    </Link>
                  </Button>
                </div>

                {/* Available spots badge */}
                {event.available_spots <= 10 && (
                  <div className="text-center">
                    <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-full">
                      Apenas {event.available_spots} vagas restantes!
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Show more hint */}
        {events && events.length > 4 && (
          <p className="text-center text-sm text-foreground/90 mt-8">
            E mais {events.length - 4} eventos disponíveis
          </p>
        )}
      </div>
    </section>
  );
};

export default Tickets;
