import { useState, useCallback } from "react";

const STORAGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zcloud-storage`;

export function useZLabsStorage({ bucket = "user-files" } = {}) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listFiles = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(STORAGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", bucket }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setError(json.error); return []; }
      setFiles(json.files ?? []); return json.files ?? [];
    } catch (e: any) { setError(e.message); return []; }
    finally { setLoading(false); }
  }, [bucket]);

  const uploadFile = useCallback(async (file: File, fileName?: string) => {
    setLoading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("action", "upload");
      fd.append("bucket", bucket);
      fd.append("file", file);
      if (fileName) fd.append("fileName", fileName);
      const res = await fetch(STORAGE_URL, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) { setError(json.error); return { success: false }; }
      return { success: true, key: json.key };
    } catch (e: any) { setError(e.message); return { success: false }; }
    finally { setLoading(false); }
  }, [bucket]);

  const downloadFile = useCallback(async (fileName: string) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(STORAGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download", bucket, fileName }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error); return null; }
      return await res.blob();
    } catch (e: any) { setError(e.message); return null; }
    finally { setLoading(false); }
  }, [bucket]);

  const getObjectUrl = useCallback(async (fileName: string) => {
    const blob = await downloadFile(fileName);
    return blob ? URL.createObjectURL(blob) : null;
  }, [downloadFile]);

  const deleteFile = useCallback(async (fileName: string) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(STORAGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", bucket, fileName }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setError(json.error); return false; }
      return true;
    } catch (e: any) { setError(e.message); return false; }
    finally { setLoading(false); }
  }, [bucket]);

  return { files, loading, error, listFiles, uploadFile, downloadFile, getObjectUrl, deleteFile };
}
