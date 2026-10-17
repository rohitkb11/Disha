import { env } from "cloudflare:workers";
import { eq, and } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { records, workspaces } from "@/db/schema";

export async function getContext() {
  const user = await getChatGPTUser();
  if (!user)
    throw new Response(
      JSON.stringify({ error: "Sign in to access your workspace." }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  const db = getDb();
  let workspace = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, user.userId))
    .get();
  if (!workspace) {
    const id = crypto.randomUUID();
    await db
      .insert(workspaces)
      .values({
        id,
        ownerId: user.userId,
        name: "My Disha learning centre",
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing();
    workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, user.userId))
      .get();
  }
  if (!workspace) throw new Error("Workspace initialization failed");
  return { user, workspace, db, binding: env.DB! };
}

export async function ownedStudent(
  context: Awaited<ReturnType<typeof getContext>>,
  id: string,
) {
  const row = await context.db
    .select()
    .from(records)
    .where(
      and(
        eq(records.id, `${context.workspace.id}:${id}`),
        eq(records.workspaceId, context.workspace.id),
        eq(records.kind, "student"),
      ),
    )
    .get();
  return row?.data as any;
}

export function mutationGuard(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new Response(
      JSON.stringify({ error: "Cross-origin writes are not allowed." }),
      { status: 403 },
    );
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new Response(
      JSON.stringify({ error: "JSON content type required." }),
      { status: 415 },
    );
  if (Number(request.headers.get("content-length") || 0) > 524288)
    throw new Response(JSON.stringify({ error: "Request too large." }), {
      status: 413,
    });
}

export async function readJson(request: Request) {
  const body = await request.text();
  if (body.length > 524288)
    throw new Response(JSON.stringify({ error: "Request too large." }), {
      status: 413,
    });
  try {
    return JSON.parse(body);
  } catch {
    throw new Response(JSON.stringify({ error: "Invalid JSON." }), {
      status: 400,
    });
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof Response) return error;
  console.error(
    "Disha API",
    error instanceof Error ? error.message : "Unknown error",
  );
  return Response.json(
    { error: "The request could not be completed. Please retry." },
    { status: 500 },
  );
}

export function aiConfig() {
  const config = env as unknown as Record<string, string | undefined>;
  return {
    url: config.OLLAMA_BASE_URL,
    model: config.OLLAMA_MODEL || "qwen2.5:1.5b",
  };
}
