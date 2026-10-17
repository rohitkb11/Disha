import { z } from "zod";
import {
  getContext,
  mutationGuard,
  readJson,
  errorResponse,
  apiError,
  runtimeConfig,
  rateLimit,
  audit,
} from "@/lib/server";
import { PILOT_CHECKS, PILOT_IDS, pilotConfiguration } from "@/lib/pilot";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const c = await getContext(request);
    if (c.access.role !== "owner")
      throw apiError(403, "Only the centre owner can manage pilot evidence.");
    const results = await c.binding
      .prepare(
        "SELECT check_id AS checkId,status,evidence,updated_at AS updatedAt FROM pilot_checks WHERE workspace_id=?",
      )
      .bind(c.workspace.id)
      .all<any>();
    const counts = await c.binding
      .prepare(
        "SELECT role,COUNT(*) AS count FROM memberships WHERE workspace_id=? AND revoked_at IS NULL GROUP BY role",
      )
      .bind(c.workspace.id)
      .all();
    const byId = new Map(results.results.map((r) => [r.checkId, r]));
    const checks = PILOT_CHECKS.map((check) => ({
      ...check,
      ...(byId.get(check.id) || {
        status: "not-run",
        evidence: "",
        updatedAt: null,
      }),
    }));
    return Response.json(
      {
        workspaceId: c.workspace.id,
        generatedAt: new Date().toISOString(),
        configuration: pilotConfiguration(runtimeConfig()),
        memberships: counts.results,
        checks,
        passed: checks.filter((c) => c.status === "passed").length,
        total: checks.length,
        notice:
          "Pilot results are owner-recorded evidence, not independent certification. Provider configuration does not imply a successful connection.",
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    mutationGuard(request);
    const input = await readJson(request);
    const c = await getContext(request);
    if (c.access.role !== "owner")
      throw apiError(403, "Only the centre owner can manage pilot evidence.");
    await rateLimit(c, "pilot", 30);
    const parsed = z
      .object({
        checkId: z
          .string()
          .refine((v) => (PILOT_IDS as readonly string[]).includes(v)),
        status: z.enum(["not-run", "passed", "failed", "blocked"]),
        evidence: z.string().trim().max(2000),
      })
      .safeParse(input);
    if (!parsed.success)
      throw apiError(
        400,
        "Choose a known pilot check, result and a note under 2,000 characters.",
      );
    const b = parsed.data;
    if (b.status !== "not-run" && b.evidence.length < 10)
      throw apiError(
        400,
        "Describe the test and evidence before recording a result.",
      );
    const now = new Date().toISOString();
    await c.binding
      .prepare(
        "INSERT INTO pilot_checks(id,workspace_id,check_id,status,evidence,actor_id,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,evidence=excluded.evidence,actor_id=excluded.actor_id,updated_at=excluded.updated_at",
      )
      .bind(
        `${c.workspace.id}:${b.checkId}`,
        c.workspace.id,
        b.checkId,
        b.status,
        b.evidence,
        c.user.userId,
        now,
      )
      .run();
    await audit(c, `pilot.${b.status}`, b.checkId);
    return Response.json({ ok: true, updatedAt: now });
  } catch (e) {
    return errorResponse(e);
  }
}
