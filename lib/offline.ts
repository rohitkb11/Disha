import Dexie, { type Table } from "dexie";
import type { AppRecord, AppState, SyncEvent } from "./types";

class OfflineDatabase extends Dexie {
  meta!: Table<{ key: string; value: any }, string>;
  entries!: Table<AppRecord & { key: string; workspace: string }, string>;
  outbox!: Table<SyncEvent & { workspace: string }, string>;
  constructor() {
    super("disha-offline-v1");
    this.version(1).stores({
      meta: "key",
      entries: "key, workspace",
      outbox: "id, workspace, queuedAt",
    });
  }
}
export const offlineDb = new OfflineDatabase();
let activeSync: Promise<{ pending: number; conflicts: string[] }> | null = null;

export async function loadState(): Promise<AppState> {
  let response: Response;
  try {
    response = await fetch("/api/state", { cache: "no-store" });
  } catch {
    const cached = await offlineDb.meta.get("last-state");
    if (!cached)
      throw new Error(
        "Connect once and sign in to prepare this device for offline learning.",
      );
    const entries = await offlineDb.entries
      .where("workspace")
      .equals(cached.value.workspace.id)
      .toArray();
    return {
      ...cached.value,
      offline: true,
      records: entries.map(({ key, workspace, ...r }) => r),
    };
  }
  if (response.status === 401) throw new Error("AUTH_REQUIRED");
  if (!response.ok)
    throw new Error(
      "The server is unavailable. Your saved work is safe. Please retry.",
    );
  const state = (await response.json()) as AppState;
  const ws = state.workspace.id;
  const pending = await offlineDb.outbox
    .where("workspace")
    .equals(ws)
    .toArray();
  const pendingIds = new Set(pending.map((e) => e.record.id));
  await offlineDb.transaction(
    "rw",
    offlineDb.entries,
    offlineDb.meta,
    async () => {
      const canonicalIds = new Set(state.records.map((r) => r.id));
      const previous = await offlineDb.entries
        .where("workspace")
        .equals(ws)
        .toArray();
      for (const record of previous)
        if (!canonicalIds.has(record.id) && !pendingIds.has(record.id))
          await offlineDb.entries.delete(record.key);
      for (const record of state.records) {
        if (!pendingIds.has(record.id))
          await offlineDb.entries.put({
            ...record,
            key: `${ws}:${record.id}`,
            workspace: ws,
          });
      }
      await offlineDb.meta.put({
        key: "last-state",
        value: { ...state, records: [] },
      });
    },
  );
  const local = await offlineDb.entries.where("workspace").equals(ws).toArray();
  return { ...state, records: local.map(({ key, workspace, ...r }) => r) };
}

export async function saveRecord(workspace: string, record: AppRecord) {
  const key = `${workspace}:${record.id}`;
  await offlineDb.transaction(
    "rw",
    offlineDb.entries,
    offlineDb.outbox,
    async () => {
      const current = await offlineDb.entries.get(key);
      const revision = current?.revision || 0;
      await offlineDb.entries.put({ ...record, revision, key, workspace });
      const pending = await offlineDb.outbox
        .where("workspace")
        .equals(workspace)
        .toArray();
      // One queued snapshot per record. In-flight events are not overwritten.
      const previous = pending.find(
        (e) => e.record.id === record.id && !(e as any).inflight,
      );
      if (previous) await offlineDb.outbox.delete(previous.id);
      await offlineDb.outbox.put({
        id: crypto.randomUUID(),
        workspace,
        record: { ...record, revision: undefined },
        baseRevision: revision,
        queuedAt: new Date().toISOString(),
      });
    },
  );
}

async function performSync(workspace: string) {
  const conflicts: string[] = [];
  const events = (
    await offlineDb.outbox
      .where("workspace")
      .equals(workspace)
      .sortBy("queuedAt")
  ).slice(0, 50);
  if (!events.length) return { pending: 0, conflicts };
  for (const e of events)
    await offlineDb.outbox.update(e.id, { inflight: true } as any);
  try {
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        events: events.map(({ workspace, ...event }) => event),
      }),
    });
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(result.error || "Sync is temporarily unavailable.");
    }
    const result = (await response.json()) as {
      acknowledged: string[];
      conflicts: { eventId: string; record: AppRecord }[];
      revisions: Record<string, number>;
    };
    await offlineDb.transaction(
      "rw",
      offlineDb.entries,
      offlineDb.outbox,
      offlineDb.meta,
      async () => {
        for (const id of result.acknowledged) await offlineDb.outbox.delete(id);
        for (const [id, revision] of Object.entries(result.revisions)) {
          await offlineDb.entries.update(`${workspace}:${id}`, { revision });
          const remaining = await offlineDb.outbox
            .where("workspace")
            .equals(workspace)
            .toArray();
          for (const event of remaining.filter((e) => e.record.id === id))
            await offlineDb.outbox.update(event.id, { baseRevision: revision });
        }
        for (const conflict of result.conflicts) {
          const event = events.find((e) => e.id === conflict.eventId)!;
          await offlineDb.meta.put({
            key: `conflict:${workspace}:${conflict.eventId}`,
            value: { local: event.record, remote: conflict.record },
          });
          await offlineDb.entries.put({
            ...conflict.record,
            key: `${workspace}:${conflict.record.id}`,
            workspace,
          });
          await offlineDb.outbox.delete(conflict.eventId);
          conflicts.push(conflict.record.id);
        }
      },
    );
  } finally {
    for (const e of events)
      await offlineDb.outbox.update(e.id, { inflight: false } as any);
  }
  return {
    pending: await offlineDb.outbox
      .where("workspace")
      .equals(workspace)
      .count(),
    conflicts,
  };
}

export function syncRecords(workspace: string) {
  if (!activeSync)
    activeSync = performSync(workspace).finally(() => {
      activeSync = null;
    });
  return activeSync;
}

export async function clearOfflineData() {
  await offlineDb.transaction(
    "rw",
    offlineDb.entries,
    offlineDb.outbox,
    offlineDb.meta,
    async () => {
      await offlineDb.entries.clear();
      await offlineDb.outbox.clear();
      await offlineDb.meta.clear();
    },
  );
}

export async function prepareOfflineShell() {
  if (!("serviceWorker" in navigator) || !("caches" in window))
    throw new Error("Offline shell caching is not supported in this browser.");
  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Offline storage is still starting. Reload once and try again.",
            ),
          ),
        10000,
      ),
    ),
  ]);
  const cache = await caches.open("disha-shell-v2");
  const urls = new Set(["/", "/icon.svg", "/manifest.webmanifest"]);
  const manifest = await fetch("/offline-assets.json", { cache: "reload" });
  if (manifest.ok && manifest.headers.get("content-type")?.includes("json")) {
    const data = (await manifest.json()) as { assets?: string[] };
    for (const asset of data.assets || [])
      if (asset.startsWith("/") && !asset.startsWith("//")) urls.add(asset);
  }
  for (const entry of performance.getEntriesByType("resource")) {
    const url = new URL(entry.name);
    if (
      url.origin === location.origin &&
      ((entry as PerformanceResourceTiming).initiatorType === "script" ||
        /\.(?:[cm]?js|tsx?|css|woff2?)(?:\?|$)/.test(url.pathname)) &&
      !url.pathname.startsWith("/api/")
    )
      urls.add(url.href);
  }
  let count = 0;
  await Promise.all(
    [...urls].map(async (url) => {
      const response = await fetch(url, { cache: "reload" });
      if (response.ok) {
        await cache.put(url, response);
        count++;
      }
    }),
  );
  if (count < 4)
    throw new Error("The application shell could not be fully cached.");
  return count;
}
