import { env } from "cloudflare:workers";
import { eq, and } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { records, workspaces, memberships } from "@/db/schema";
import { canAccessStudent, type Access } from "./access";
import { digest } from "./crypto";

export async function getContext(request?: Request) {
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
  let access: Access = { role: "owner", userId: user.userId, subjectId: null };
  const requested = request?.headers.get("x-disha-workspace");
  if (requested && requested !== workspace.id) {
    const other = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, requested))
      .get();
    const member = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.workspaceId, requested),
          eq(memberships.userId, user.userId),
        ),
      )
      .get();
    if (!other || !member || member.revokedAt)
      throw apiError(
        403,
        "You no longer have access to this centre. Clear its offline copy on shared devices.",
      );
    workspace = other;
    access = {
      role: member.role as Access["role"],
      userId: user.userId,
      subjectId: member.subjectId,
    };
  }
  return { user, workspace, access, db, binding: env.DB! };
}

export function apiError(status: number, error: string) {
  return Response.json(
    { error },
    { status, headers: { "cache-control": "no-store" } },
  );
}
export async function audit(
  context: Awaited<ReturnType<typeof getContext>>,
  action: string,
  entity: string,
) {
  await context.binding
    .prepare(
      "INSERT INTO audit_log (id,workspace_id,actor_id,action,entity_id,created_at) VALUES (?,?,?,?,?,?)",
    )
    .bind(
      crypto.randomUUID(),
      context.workspace.id,
      context.user.userId,
      action,
      entity,
      new Date().toISOString(),
    )
    .run();
}
// Durable counters work across Worker isolates; no IP addresses or question text are retained.
export async function rateLimit(
  context: Awaited<ReturnType<typeof getContext>>,
  action: string,
  limit = 12,
) {
  const minute = Math.floor(Date.now() / 60000);
  const key = await digest(`${context.user.userId}:${action}:${minute}`);
  const row = await context.binding
    .prepare(
      "INSERT INTO service_counters (id,count,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count",
    )
    .bind(key, (minute + 2) * 60000)
    .first<{ count: number }>();
  await context.binding
    .prepare(
      "DELETE FROM service_counters WHERE id IN (SELECT id FROM service_counters WHERE expires_at < ? LIMIT 20)",
    )
    .bind(Date.now())
    .run();
  if (!row || row.count > limit)
    throw apiError(
      429,
      "Too many requests. Please wait a minute and try again.",
    );
}

export async function ownedStudent(
  context: Awaited<ReturnType<typeof getContext>>,
  id: string,
) {
  if (!canAccessStudent(context.access, id))
    throw apiError(403, "This learner is outside your access.");
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
    account: config.CLOUDFLARE_AI_ACCOUNT_ID,
    token: config.CLOUDFLARE_AI_TOKEN,
    cloudModel: config.CLOUDFLARE_AI_MODEL || "@cf/qwen/qwen3-30b-a3b-fp8",
  };
}

export function runtimeConfig() {
  return env as unknown as Record<string, string | undefined>;
}
