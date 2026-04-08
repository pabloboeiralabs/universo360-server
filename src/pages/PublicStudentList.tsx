import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Printer, Users, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StudentData {
  student_name: string;
  class_grade: string;
  shift: string;
  quantity: number;
}

interface EventData {
  school_name: string;
  event_date: string;
  event_time: string;
}

const POLL_INTERVAL = 30000;

const PublicStudentList = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [gradeOrder, setGradeOrder] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [, setTick] = useState(0); // force re-render for relative time
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!eventId) return;
    if (!silent) setIsLoading(true);
    else setIsPolling(true);

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/public-student-list?eventId=${eventId}`,
        { headers: { 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Erro ao carregar dados');
      }

      const result = await response.json();
      setEvent(result.event);
      setStudents(result.students);
      setGradeOrder(result.grade_order || []);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      if (!silent) setError(err.message || 'Erro ao carregar lista');
    } finally {
      setIsLoading(false);
      setIsPolling(false);
    }
  }, [eventId]);

  // Initial fetch + polling
  useEffect(() => {
    fetchData();

    intervalRef.current = setInterval(() => {
      if (!document.hidden) fetchData(true);
    }, POLL_INTERVAL);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  // Pause polling when tab hidden
  useEffect(() => {
    const handler = () => {
      if (!document.hidden) fetchData(true);
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [fetchData]);

  // Update relative time every 30s
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const grouped = students.reduce<Record<string, StudentData[]>>((acc, s) => {
    const key = s.class_grade;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  // Sort keys by franchise-defined order; unknowns go to the end sorted alphabetically
  const sortedGradeKeys = [
    ...gradeOrder.filter((g) => grouped[g]),
    ...Object.keys(grouped).filter((g) => !gradeOrder.includes(g)).sort(),
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">Evento não encontrado</h1>
          <p className="text-muted-foreground">{error || 'Este evento não existe ou não está mais ativo.'}</p>
        </div>
      </div>
    );
  }

  const totalStudents = students.reduce((sum, s) => sum + s.quantity, 0);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 print:mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{event.school_name}</h1>
            <p className="text-muted-foreground">
              {format(new Date(event.event_date + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              {' às '}
              {event.event_time.slice(0, 5)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              <Users className="inline h-4 w-4 mr-1" />
              {totalStudents} aluno{totalStudents !== 1 ? 's' : ''} confirmado{totalStudents !== 1 ? 's' : ''}
            </p>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground mt-1 print:hidden">
                {isPolling && <RefreshCw className="inline h-3 w-3 mr-1 animate-spin" />}
                Atualizado {formatDistanceToNow(lastUpdated, { locale: ptBR, addSuffix: true })}
              </p>
            )}
          </div>
          <div className="flex gap-2 print:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={isPolling}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isPolling ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>

        {/* Student List grouped by grade */}
        {sortedGradeKeys.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum aluno confirmado ainda.
          </div>
        ) : (
          <div className="space-y-6">
            {sortedGradeKeys.map((grade) => {
              const gradeStudents = grouped[grade];
              return (
                <div key={grade}>
                  <h2 className="text-lg font-semibold text-foreground mb-2 border-b pb-1">
                    {grade}
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({gradeStudents.reduce((s, st) => s + st.quantity, 0)} aluno{gradeStudents.reduce((s, st) => s + st.quantity, 0) !== 1 ? 's' : ''})
                    </span>
                  </h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-1 pr-4">#</th>
                        <th className="py-1 pr-4">Nome do Aluno</th>
                        <th className="py-1">Turno</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradeStudents.map((student, idx) => (
                        <tr key={idx} className="border-b border-border/50">
                          <td className="py-1.5 pr-4 text-muted-foreground">{idx + 1}</td>
                          <td className="py-1.5 pr-4 text-foreground">{student.student_name}</td>
                          <td className="py-1.5 text-muted-foreground">{{ morning: 'Manhã', afternoon: 'Tarde', full_time: 'Integral', night: 'Noite' }[student.shift || ''] || student.shift || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer for print */}
        <div className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground print:block hidden">
          Lista gerada em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")} - Universo 360
        </div>
      </div>
    </div>
  );
};

export default PublicStudentList;
