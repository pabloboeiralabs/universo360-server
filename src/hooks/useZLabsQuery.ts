import { useState, useCallback } from "react";

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zcloud-proxy`;
const SETUP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zcloud-setup`;

interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  columns: string[];
  rowCount: number;
  duration: number;
  command: string;
}

export function useZLabsQuery<T = Record<string, unknown>>() {
  const [data, setData] = useState<QueryResult<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (query: string, params: unknown[] = []) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, params }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setError(json.error ?? "Erro desconhecido"); return null; }
      setData(json as QueryResult<T>);
      return json as QueryResult<T>;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally { setLoading(false); }
  }, []);

  return { execute, data, loading, error };
}

export async function syncSchema(statements: string[]) {
  if (statements.length === 0) return { success: false, created: 0, failed: 0 };
  try {
    const res = await fetch(SETUP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statements }),
    });
    const json = await res.json();
    return { success: json.success ?? false, created: json.created ?? 0, failed: json.failed ?? 0 };
  } catch { return { success: false, created: 0, failed: 0 }; }
}
