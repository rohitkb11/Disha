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
export async function GET(request: Request) {
  try {
    const c = await getContext(request);
    let query = "SELECT * FROM submissions WHERE workspace_id=?";
    const args: any[] = [c.workspace.id];
    if (!isFacilitator(c.access)) {
      if (c.access.role === "student") {
        query += " AND student_id=?";
        args.push(c.access.subjectId);
      } else if (c.access.role === "employer") {
        query += " AND partner_id=?";
        args.push(c.user.userId);
      } else throw apiError(403, "This role cannot view applications.");
    }
    const rows = (
      await c.binding
        .prepare(query + " ORDER BY created_at DESC LIMIT 200")
        .bind(...args)
        .all<any>()
    ).results.map((r) => ({ ...r, snapshot: JSON.parse(r.snapshot) }));
    return Response.json(
      { submissions: rows },
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
    await rateLimit(c, "submissions", 20);
    const parsed = z
      .discriminatedUnion("action", [
        z.object({
          action: z.literal("submit"),
          studentId: z.string().max(120),
          opportunityId: z.string().max(120),
          consent: z.literal(true),
          message: z.string().trim().min(1).max(3000),
        }),
        z.object({
          action: z.literal("review"),
          id: z.string().uuid(),
          status: z.enum(["Under review", "Accepted", "Rejected", "Withdrawn"]),
          response: z.string().max(2000),
        }),
      ])
      .safeParse(await readJson(request));
    if (!parsed.success)
      throw apiError(
        400,
        "Review the application and consent before submitting.",
      );
    const b = parsed.data;
    const now = new Date().toISOString();
    if (b.action === "submit") {
      const student = await ownedStudent(c, b.studentId);
      if (!student) throw apiError(404, "Sync your learner profile first.");
      const row = await c.binding
        .prepare(
          "SELECT data FROM records WHERE workspace_id=? AND id=? AND kind='opportunity'",
        )
        .bind(c.workspace.id, `${c.workspace.id}:${b.opportunityId}`)
        .first<any>();
      const o = row && JSON.parse(row.data);
      if (!o || o.sample || o.intake !== "disha" || !o.partnerUserId)
        throw apiError(
          400,
          "This provider accepts applications on its own website. Disha cannot submit to it.",
        );
      if (o.deadline && Date.parse(o.deadline + "T23:59:59Z") < Date.now())
        throw apiError(409, "This opportunity's listed deadline has passed.");
      const partner = await c.binding
        .prepare(
          "SELECT id FROM memberships WHERE workspace_id=? AND user_id=? AND role='employer' AND revoked_at IS NULL",
        )
        .bind(c.workspace.id, o.partnerUserId)
        .first();
      if (!partner)
        throw apiError(
          409,
          "This partner is no longer accepting applications here.",
        );
      const id = crypto.randomUUID();
      const snapshot = {
        name: student.profile.name,
        education: student.profile.grade,
        district: student.profile.district,
        interests: student.profile.interests,
        message: b.message,
        opportunity: o.title,
        consentAt: now,
      };
      const result = await c.binding
        .prepare(
          "INSERT INTO submissions (id,workspace_id,student_id,opportunity_id,partner_id,status,snapshot,response,created_at,updated_at) VALUES (?,?,?,?,?,'Received',?,'',?,?) ON CONFLICT(workspace_id,student_id,opportunity_id) DO NOTHING RETURNING id",
        )
        .bind(
          id,
          c.workspace.id,
          b.studentId,
          b.opportunityId,
          o.partnerUserId,
          JSON.stringify(snapshot),
          now,
          now,
        )
        .first();
      if (!result)
        throw apiError(
          409,
          "An application has already been submitted for this learner and opportunity.",
        );
      await audit(c, "application.submitted", id);
      return Response.json({ id, status: "Received" });
    }
    const row = await c.binding
      .prepare("SELECT * FROM submissions WHERE id=? AND workspace_id=?")
      .bind(b.id, c.workspace.id)
      .first<any>();
    if (!row) throw apiError(404, "Application not found.");
    if (b.status === "Withdrawn") {
      if (!(
        isFacilitator(c.access) ||
        (c.access.role === "student" && c.access.subjectId === row.student_id)
      ))
        throw apiError(
          403,
          "Only the learner or facilitator can withdraw this application.",
        );
    } else if (!(
      isFacilitator(c.access) ||
      (c.access.role === "employer" && c.user.userId === row.partner_id)
    ))
      throw apiError(
        403,
        "Only the receiving partner or facilitator can review this application.",
      );
    if (["Rejected", "Withdrawn"].includes(row.status))
      throw apiError(409, "This application has already closed.");
    await c.binding
      .prepare(
        "UPDATE submissions SET status=?,response=?,updated_at=? WHERE id=?",
      )
      .bind(b.status, b.response, now, b.id)
      .run();
    await audit(c, `application.${b.status}`, b.id);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
