import { records } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getContext, aiConfig, errorResponse } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { db, workspace, user } = await getContext();
    const rows = await db
      .select()
      .from(records)
      .where(eq(records.workspaceId, workspace.id));
    return Response.json(
      {
        workspace: { id: workspace.id, name: workspace.name },
        user: {
          userId: user.userId,
          name: user.displayName,
          email: user.email,
        },
        aiAvailable: Boolean(aiConfig().url),
        records: rows.map((r) => ({
          id: r.id.slice(workspace.id.length + 1),
          kind: r.kind,
          data: r.data,
          updatedAt: r.updatedAt,
          revision: r.revision,
        })),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
