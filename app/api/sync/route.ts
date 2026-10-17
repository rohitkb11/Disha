import { z } from "zod";
import {
  getContext,
  mutationGuard,
  readJson,
  errorResponse,
  apiError,
} from "@/lib/server";
import { canWriteRecord } from "@/lib/access";
import { eventSchema, validateRecord } from "@/lib/validation";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    mutationGuard(request);
    const { binding, workspace, access } = await getContext(request);
    const parsed = z
      .object({ events: z.array(eventSchema).max(50) })
      .safeParse(await readJson(request));
    if (!parsed.success)
      return Response.json({ error: "Invalid sync request." }, { status: 400 });
    if (
      parsed.data.events.some(
        (e) => !validateRecord(e.record.kind, e.record.data),
      )
    )
      return Response.json({ error: "Invalid record data." }, { status: 400 });
    const acknowledged: string[] = [],
      conflicts: any[] = [],
      revisions: Record<string, number> = {};
    for (const event of parsed.data.events) {
      const dbId = `${workspace.id}:${event.record.id}`;
      const eventId = `${workspace.id}:${event.id}`;
      const duplicate = await binding
        .prepare(
          "SELECT id FROM processed_events WHERE id = ? AND workspace_id = ?",
        )
        .bind(eventId, workspace.id)
        .first();
      const current = await binding
        .prepare(
          "SELECT revision, last_event, data, kind, updated_at FROM records WHERE id = ? AND workspace_id = ?",
        )
        .bind(dbId, workspace.id)
        .first<any>();
      const currentRecord = current
        ? {
            id: event.record.id,
            kind: current.kind,
            data: JSON.parse(current.data),
            updatedAt: current.updated_at,
          }
        : undefined;
      if (!canWriteRecord(access, event.record, currentRecord))
        throw apiError(403, "Your role cannot edit this record.");
      if (
        ["student", "course", "mentor", "opportunity"].includes(
          event.record.kind,
        ) &&
        event.record.data.id !== event.record.id
      )
        throw apiError(400, "Record and profile IDs must match.");
      if (event.record.kind === "opportunity") {
        const data = event.record.data;
        // Employer ownership and intake permissions come from identity, never the submitted JSON.
        data.partnerUserId =
          access.role === "employer"
            ? access.userId
            : currentRecord?.data.partnerUserId;
        data.intake =
          access.role === "employer" || data.partnerUserId
            ? "disha"
            : "external";
        data.sample = false;
        data.criteria = [];
        data.verifiedAt = new Date().toISOString().slice(0, 10);
      }
      if (event.record.kind === "mentor")
        event.record.data.onboarded =
          access.role === "mentor" || currentRecord?.data.onboarded === true;
      if (event.record.kind === "progress") {
        const cid = event.record.data.courseId;
        const course = await binding
          .prepare(
            "SELECT data FROM records WHERE id=? AND workspace_id=? AND kind='course'",
          )
          .bind(`${workspace.id}:${cid}`, workspace.id)
          .first<any>();
        if (
          course &&
          JSON.parse(course.data).price > 0 &&
          access.role === "student"
        ) {
          const grant = await binding
            .prepare(
              "SELECT id FROM entitlements WHERE workspace_id=? AND user_id=? AND expires_at>? AND product_id IN (?, 'centre_month')",
            )
            .bind(workspace.id, access.userId, Date.now(), `course_${cid}`)
            .first();
          if (!grant)
            throw apiError(
              403,
              "Purchase this module or a centre pass before recording progress.",
            );
        }
      }
      if (duplicate || current?.last_event === event.id) {
        acknowledged.push(event.id);
        if (current) revisions[event.record.id] = current.revision;
        continue;
      }
      if (current && current.revision !== event.baseRevision) {
        conflicts.push({
          eventId: event.id,
          record: {
            id: event.record.id,
            kind: current.kind,
            data: JSON.parse(current.data),
            updatedAt: current.updated_at,
            revision: current.revision,
          },
        });
        continue;
      }
      if (!current && event.baseRevision !== 0)
        throw apiError(
          409,
          "The original record is no longer available. Refresh your workspace.",
        );
      const result = await binding
        .prepare(
          "INSERT INTO records (id, workspace_id, kind, data, updated_at, revision, last_event) VALUES (?, ?, ?, ?, ?, 1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, revision = records.revision + 1, last_event = excluded.last_event WHERE records.workspace_id = excluded.workspace_id AND records.revision = ? RETURNING revision",
        )
        .bind(
          dbId,
          workspace.id,
          event.record.kind,
          JSON.stringify(event.record.data),
          event.record.updatedAt,
          event.id,
          event.baseRevision,
        )
        .first<{ revision: number }>();
      if (!result) {
        const latest = await binding
          .prepare(
            "SELECT kind,data,updated_at,revision FROM records WHERE id=? AND workspace_id=?",
          )
          .bind(dbId, workspace.id)
          .first<any>();
        conflicts.push({
          eventId: event.id,
          record: {
            id: event.record.id,
            kind: latest.kind,
            data: JSON.parse(latest.data),
            updatedAt: latest.updated_at,
            revision: latest.revision,
          },
        });
        continue;
      }
      await binding
        .prepare(
          "INSERT OR IGNORE INTO processed_events (id,workspace_id,created_at) VALUES (?,?,?)",
        )
        .bind(eventId, workspace.id, new Date().toISOString())
        .run();
      revisions[event.record.id] = result.revision;
      acknowledged.push(event.id);
    }
    return Response.json({ acknowledged, conflicts, revisions });
  } catch (error) {
    return errorResponse(error);
  }
}
