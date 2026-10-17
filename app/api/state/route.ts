import { records } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getContext,
  aiConfig,
  runtimeConfig,
  errorResponse,
} from "@/lib/server";
import { canReadRecord, isFacilitator } from "@/lib/access";
import type { AppRecord } from "@/lib/types";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { db, workspace, user, access, binding } = await getContext(request);
    const spaces = (
      await binding
        .prepare(
          "SELECT id,name,'owner' AS role FROM workspaces WHERE owner_id=? UNION SELECT w.id,w.name,m.role FROM workspaces w JOIN memberships m ON m.workspace_id=w.id WHERE m.user_id=? AND m.revoked_at IS NULL",
        )
        .bind(user.userId, user.userId)
        .all()
    ).results;
    const grants = (
      await binding
        .prepare(
          "SELECT product_id FROM entitlements WHERE workspace_id=? AND user_id=? AND expires_at>?",
        )
        .bind(workspace.id, user.userId, Date.now())
        .all<any>()
    ).results.map((r) => r.product_id);
    const rows = await db
      .select()
      .from(records)
      .where(eq(records.workspaceId, workspace.id));
    return Response.json(
      {
        workspace: { id: workspace.id, name: workspace.name },
        access,
        workspaces: spaces,
        integrations: {
          ai:
            aiConfig().account && aiConfig().token
              ? "cloudflare"
              : aiConfig().url
                ? "ollama"
                : "retrieval",
          payments: Boolean(
            runtimeConfig().RAZORPAY_KEY_ID &&
            runtimeConfig().RAZORPAY_KEY_SECRET,
          ),
          partnerFeed: Boolean(runtimeConfig().DISHA_PARTNER_FEED_URL),
        },
        user: {
          userId: user.userId,
          name: user.displayName,
          email: user.email,
        },
        aiAvailable: Boolean(
          aiConfig().url || (aiConfig().account && aiConfig().token),
        ),
        records: rows
          .map(
            (r) =>
              ({
                id: r.id.slice(workspace.id.length + 1),
                kind: r.kind,
                data: r.data,
                updatedAt: r.updatedAt,
                revision: r.revision,
              }) as AppRecord,
          )
          .filter((r) => canReadRecord(access, r))
          .map((r) => {
            if (
              r.kind === "course" &&
              r.data.price > 0 &&
              !isFacilitator(access) &&
              !grants.includes(`course_${r.id}`) &&
              !grants.includes("centre_month")
            )
              return { ...r, data: { ...r.data, lessons: [], locked: true } };
            return r;
          }),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
