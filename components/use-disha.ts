"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { loadState, offlineDb, saveRecord, syncRecords } from "@/lib/offline";
import { sampleStudents } from "@/lib/catalog";
import type { AppRecord, AppState, Lang } from "@/lib/types";
import { canWriteRecord } from "@/lib/access";

export function useDisha() {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lang, setLang] = useState<Lang>("en");
  const [studentId, setStudentId] = useState("");
  const [page, setPage] = useState("home");
  const stateRef = useRef(state);
  stateRef.current = state;
  const navigate = useCallback((next: string) => {
    setPage(next);
    window.location.hash = next;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const sync = useCallback(async (silent = false) => {
    const current = stateRef.current;
    if (!current || !navigator.onLine) return;
    setSyncing(true);
    try {
      const result = await syncRecords(current.workspace.id);
      setPending(result.pending);
      if (result.conflicts.length) {
        toast.warning(
          "Another device changed this record. The server version was restored; your draft is retained in Settings.",
        );
        const fresh = await loadState();
        setState(fresh);
      } else if (!silent)
        toast.success("Your changes are saved to your workspace.");
    } catch (e) {
      if (!silent)
        toast.error(
          e instanceof Error
            ? e.message
            : "Sync failed. Your work remains on this device.",
        );
    } finally {
      setSyncing(false);
    }
  }, []);
  const save = useCallback(
    async (kind: AppRecord["kind"], id: string, data: any) => {
      const current = stateRef.current;
      if (!current) return;
      const record: AppRecord = {
        kind,
        id,
        data,
        updatedAt: new Date().toISOString(),
      };
      if (
        !canWriteRecord(
          current.access,
          record,
          current.records.find((r) => r.id === id),
        )
      )
        throw new Error("Your role cannot edit this record.");
      await saveRecord(current.workspace.id, record);
      setState((old) =>
        old
          ? {
              ...old,
              records: [...old.records.filter((r) => r.id !== id), record],
            }
          : old,
      );
      setPending(
        await offlineDb.outbox
          .where("workspace")
          .equals(current.workspace.id)
          .count(),
      );
      if (navigator.onLine) void sync(true);
    },
    [sync],
  );
  const initialize = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await loadState();
      setOnline(navigator.onLine && !data.offline);
      if (data.records.length === 0 && data.access.role === "owner") {
        const samples = sampleStudents();
        for (const student of samples) {
          const record: AppRecord = {
            id: student.id,
            kind: "student",
            data: student,
            updatedAt: new Date().toISOString(),
          };
          await saveRecord(data.workspace.id, record);
          data.records.push(record);
        }
      }
      setState(data);
      stateRef.current = data;
      const savedStudent = localStorage.getItem(
        `disha-student-${data.workspace.id}`,
      );
      setStudentId(
        data.records.some((r) => r.kind === "student" && r.id === savedStudent)
          ? savedStudent!
          : data.records.find((r) => r.kind === "student")?.id || "",
      );
      setPending(
        await offlineDb.outbox
          .where("workspace")
          .equals(data.workspace.id)
          .count(),
      );
      if (navigator.onLine) void sync(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load your workspace.",
      );
    } finally {
      setLoading(false);
    }
  }, [sync]);
  useEffect(() => {
    setOnline(navigator.onLine);
    const stored = localStorage.getItem("disha-language");
    if (["en", "hi", "mr"].includes(stored || "")) {
      setLang(stored as Lang);
      document.documentElement.lang = stored!;
    }
    const onHash = () => {
      const value = window.location.hash.slice(1);
      if (value === "main-content") return;
      setPage(
        [
          "home",
          "discover",
          "learn",
          "opportunities",
          "mentors",
          "passport",
          "facilitator",
          "settings",
          "community",
        ].includes(value)
          ? value
          : "home",
      );
    };
    onHash();
    const onOnline = () => {
      setOnline(true);
      void sync(true);
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("hashchange", onHash);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    void initialize();
    const timer = setInterval(() => void sync(true), 20000);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      clearInterval(timer);
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [initialize, sync]);
  useEffect(() => {
    if (state && studentId)
      localStorage.setItem(`disha-student-${state.workspace.id}`, studentId);
  }, [studentId, state?.workspace.id]);
  const changeLang = (value: Lang) => {
    setLang(value);
    localStorage.setItem("disha-language", value);
    document.documentElement.lang = value;
    window.dispatchEvent(new Event("disha-language-change"));
  };
  return {
    state,
    loading,
    error,
    online,
    pending,
    syncing,
    lang,
    studentId,
    page,
    setStudentId,
    navigate,
    save,
    sync,
    initialize,
    changeLang,
  };
}
