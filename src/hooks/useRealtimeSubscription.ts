import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface RealtimeFilter {
  column: string;
  value: string;
}

export function useRealtimeSubscription(
  table: string,
  queryKeys: unknown[][],
  filter?: RealtimeFilter
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channelName = filter 
      ? `${table}-${filter.column}-${filter.value}` 
      : `${table}-all`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: filter ? `${filter.column}=eq.${filter.value}` : undefined,
        },
        () => {
          // Invalidate all related query keys
          queryKeys.forEach((queryKey) => {
            queryClient.invalidateQueries({ queryKey });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, JSON.stringify(queryKeys), filter?.column, filter?.value, queryClient]);
}
