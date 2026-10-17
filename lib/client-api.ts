export function activeWorkspace() {
  return typeof window !== "undefined"
    ? localStorage.getItem("disha-workspace") || ""
    : "";
}
export function apiFetch(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const ws = activeWorkspace();
  if (ws) headers.set("x-disha-workspace", ws);
  return fetch(url, { ...init, headers, cache: "no-store" });
}
export async function apiCall<T = any>(
  url: string,
  body?: unknown,
): Promise<T> {
  const response = await apiFetch(
    url,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = (await response.json()) as any;
  if (!response.ok)
    throw new Error(data.error || "The request could not be completed.");
  return data as T;
}
