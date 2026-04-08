import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, GraduationCap, Calendar, Search, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAdminContext } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StudentReport from '@/components/franchise/StudentReport';

interface Event {
  id: string;
  school_name: string;
  event_date: string;
  event_time: string;
  total_capacity: number;
  available_spots: number;
  is_active: boolean;
}

const AdminStudentsPage = () => {
  const { adminFranchiseId, isLoadingFranchise } = useAdminContext();
  const [search, setSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const { data: events, isLoading: isLoadingEvents } = useQuery({
    queryKey: ['admin-events-for-students', adminFranchiseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, school_name, event_date, event_time, total_capacity, available_spots, is_active')
        .eq('franchise_id', adminFranchiseId!)
        .order('event_date', { ascending: false });

      if (error) throw error;
      return data as Event[];
    },
    enabled: !!adminFranchiseId,
  });

  const filteredEvents = events?.filter((event) =>
    event.school_name.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoadingFranchise) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!adminFranchiseId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Erro ao carregar dados da franquia. Tente recarregar a página.
      </div>
    );
  }

  return (
    <div className="p-2 md:p-8">
      <div className="mb-6">
        <h1 className="text-lg md:text-3xl font-bold">Meus Alunos</h1>
        <p className="text-muted-foreground">
          Visualize os alunos inscritos por evento
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Selecione um Evento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar evento por nome da escola..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoadingEvents ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !filteredEvents || filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum evento encontrado</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredEvents.map((event) => {
                const soldTickets = event.total_capacity - event.available_spots;
                return (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Calendar className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{event.school_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(event.event_date + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} às {event.event_time}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <Badge variant={event.is_active ? 'default' : 'secondary'}>
                        {event.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {soldTickets} aluno(s)
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedEvent(event)}
                      >
                        <GraduationCap className="h-4 w-4 mr-2" />
                        Ver Alunos
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedEvent && (
        <StudentReport
          eventId={selectedEvent.id}
          eventName={selectedEvent.school_name}
          eventDate={selectedEvent.event_date}
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
};

export default AdminStudentsPage;
