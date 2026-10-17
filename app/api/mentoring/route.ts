import { z } from "zod";
import {
  getContext,
  ownedStudent,
  mutationGuard,
  readJson,
  errorResponse,
  apiError,
  rateLimit,
  audit,
} from "@/lib/server";
import { isFacilitator } from "@/lib/access";
export const dynamic = "force-dynamic";
async function visibleSession(
  c: Awaited<ReturnType<typeof getContext>>,
  id: string,
) {
  const s = await c.binding
    .prepare("SELECT * FROM mentor_sessions WHERE id=? AND workspace_id=?")
    .bind(id, c.workspace.id)
    .first<any>();
  if (
    !s ||
    !(
      isFacilitator(c.access) ||
      (c.access.role === "student" && c.access.subjectId === s.student_id) ||
      (c.access.role === "mentor" && c.access.subjectId === s.mentor_id)
    )
  )
    throw apiError(403, "This session is outside your access.");
  return s;
}
export async function GET(request: Request) {
  try {
    const c = await getContext(request);
    const mentors = (
      await c.binding
        .prepare(
          "SELECT r.data FROM records r JOIN memberships m ON m.workspace_id=r.workspace_id AND m.subject_id=json_extract(r.data,'$.id') AND m.role='mentor' AND m.revoked_at IS NULL WHERE r.workspace_id=? AND r.kind='mentor'",
        )
        .bind(c.workspace.id)
        .all<any>()
    ).results.map((r) => JSON.parse(r.data));
    const rows = (
      await c.binding
        .prepare(
          "SELECT s.*, json_extract(r.data,'$.profile.name') AS student_name, json_extract(m.data,'$.name') AS mentor_name FROM mentor_sessions s LEFT JOIN records r ON r.id=s.workspace_id||':'||s.student_id LEFT JOIN records m ON m.id=s.workspace_id||':'||s.mentor_id WHERE s.workspace_id=? ORDER BY s.starts_at DESC LIMIT 200",
        )
        .bind(c.workspace.id)
        .all<any>()
    ).results;
    const sessions = rows.filter(
      (s) =>
        isFacilitator(c.access) ||
        (c.access.role === "student" && c.access.subjectId === s.student_id) ||
        (c.access.role === "mentor" && c.access.subjectId === s.mentor_id),
    );
    const id = new URL(request.url).searchParams.get("session");
    let messages: any[] = [];
    if (id) {
      await visibleSession(c, id);
      messages = (
        await c.binding
          .prepare(
            "SELECT id,sender_name AS senderName,text,created_at AS createdAt FROM (SELECT * FROM session_messages WHERE session_id=? ORDER BY created_at DESC LIMIT 100) ORDER BY created_at ASC",
          )
          .bind(id)
          .all()
      ).results;
    }
    return Response.json(
      { mentors, sessions, messages },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    mutationGuard(request);
    const c = await getContext(request);
    await rateLimit(c, "mentoring", 30);
    const parsed = z
      .discriminatedUnion("action", [
        z.object({
          action: z.literal("propose"),
          studentId: z.string().max(120),
          mentorId: z.string().max(120),
          startsAt: z.string().datetime(),
          minutes: z.number().int().min(15).max(120),
          goal: z.string().trim().min(1).max(2000),
        }),
        z.object({
          action: z.literal("status"),
          id: z.string().uuid(),
          status: z.enum(["confirmed", "cancelled", "completed"]),
        }),
        z.object({
          action: z.literal("message"),
          id: z.string().uuid(),
          text: z.string().trim().min(1).max(2000),
        }),
      ])
      .safeParse(await readJson(request));
    if (!parsed.success)
      throw apiError(400, "Check the session time and details.");
    const b = parsed.data;
    if (b.action === "propose") {
      const student = await ownedStudent(c, b.studentId);
      if (!student) throw apiError(404, "Learner not found. Sync first.");
      const mentor = await c.binding
        .prepare(
          "SELECT id FROM memberships WHERE workspace_id=? AND role='mentor' AND subject_id=? AND revoked_at IS NULL",
        )
        .bind(c.workspace.id, b.mentorId)
        .first();
      if (!mentor)
        throw apiError(
          400,
          "This mentor has not joined the centre. Ask your facilitator to invite them first.",
        );
      const time = Date.parse(b.startsAt);
      if (time < Date.now() || time > Date.now() + 366 * 86400000)
        throw apiError(400, "Choose a future time within the next year.");
      const id = crypto.randomUUID();
      const inserted = await c.binding
        .prepare(
          "INSERT INTO mentor_sessions (id,workspace_id,student_id,mentor_id,starts_at,minutes,status,goal,created_at) SELECT ?,?,?,?,?,?,'proposed',?,? WHERE NOT EXISTS (SELECT 1 FROM mentor_sessions WHERE workspace_id=? AND status!='cancelled' AND (mentor_id=? OR student_id=?) AND julianday(starts_at) < julianday(?) + ? / 1440.0 AND julianday(starts_at) + minutes / 1440.0 > julianday(?)) RETURNING id",
        )
        .bind(
          id,
          c.workspace.id,
          b.studentId,
          b.mentorId,
          b.startsAt,
          b.minutes,
          b.goal,
          new Date().toISOString(),
          c.workspace.id,
          b.mentorId,
          b.studentId,
          b.startsAt,
          b.minutes,
          b.startsAt,
        )
        .first();
      if (!inserted)
        throw apiError(
          409,
          "The mentor or learner already has a session at that time.",
        );
      await audit(c, "session.proposed", id);
      return Response.json({ id });
    }
    const s = await visibleSession(c, b.id);
    if (b.action === "message") {
      if (s.status === "cancelled")
        throw apiError(409, "This session was cancelled.");
      await c.binding
        .prepare(
          "INSERT INTO session_messages (id,session_id,sender_id,sender_name,text,created_at) VALUES (?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          b.id,
          c.user.userId,
          c.user.displayName,
          b.text,
          new Date().toISOString(),
        )
        .run();
    } else {
      if (c.access.role === "student" && b.status !== "cancelled")
        throw apiError(
          403,
          "Your mentor or facilitator confirms and completes sessions.",
        );
      if (["cancelled", "completed"].includes(s.status))
        throw apiError(409, "This session has already ended.");
      if (
        b.status === "completed" &&
        (s.status !== "confirmed" || Date.parse(s.starts_at) > Date.now())
      )
        throw apiError(
          409,
          "Confirm the session and wait until its start time before marking it complete.",
        );
      await c.binding
        .prepare("UPDATE mentor_sessions SET status=? WHERE id=? AND status=?")
        .bind(b.status, b.id, s.status)
        .run();
      await audit(c, `session.${b.status}`, b.id);
    }
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
