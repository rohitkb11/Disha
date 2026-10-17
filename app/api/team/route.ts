import { z } from "zod";
import {
  getContext,
  mutationGuard,
  readJson,
  errorResponse,
  apiError,
  rateLimit,
  audit,
} from "@/lib/server";
import { digest } from "@/lib/crypto";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const c = await getContext(request);
    if (c.access.role !== "owner")
      throw apiError(403, "Only the centre owner can manage membership.");
    const members = (
      await c.binding
        .prepare(
          "SELECT id,user_id AS userId,name,email,role,subject_id AS subjectId,revoked_at AS revokedAt FROM memberships WHERE workspace_id=?",
        )
        .bind(c.workspace.id)
        .all()
    ).results;
    const invites = (
      await c.binding
        .prepare(
          "SELECT id,email,role,subject_id AS subjectId,expires_at AS expiresAt,claimed_by AS claimedBy,revoked_at AS revokedAt FROM invitations WHERE workspace_id=? ORDER BY created_at DESC LIMIT 100",
        )
        .bind(c.workspace.id)
        .all()
    ).results;
    const audit = (
      await c.binding
        .prepare(
          "SELECT action,entity_id AS entityId,created_at AS createdAt FROM audit_log WHERE workspace_id=? ORDER BY created_at DESC LIMIT 30",
        )
        .bind(c.workspace.id)
        .all()
    ).results;
    return Response.json(
      { members, invites, audit },
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
    await rateLimit(c, "team", 20);
    const body = z
      .discriminatedUnion("action", [
        z.object({
          action: z.literal("join"),
          token: z.string().regex(/^[a-zA-Z0-9_-]{64}$/),
        }),
        z.object({
          action: z.literal("invite"),
          email: z.string().email().max(254),
          role: z.enum(["teacher", "student", "mentor", "employer"]),
          subjectId: z
            .string()
            .regex(/^[a-zA-Z0-9_-]{1,120}$/)
            .nullable(),
        }),
        z.object({
          action: z.literal("revoke-member"),
          id: z.string().max(200),
        }),
        z.object({
          action: z.literal("revoke-invite"),
          id: z.string().max(200),
        }),
      ])
      .safeParse(await readJson(request));
    if (!body.success)
      throw apiError(400, "Check the email, role and invitation code.");
    const b = body.data;
    const now = new Date().toISOString();
    if (b.action === "join") {
      const hash = await digest(b.token);
      const invite = await c.binding
        .prepare(
          "SELECT * FROM invitations WHERE token_hash=? AND email=? AND claimed_by IS NULL AND revoked_at IS NULL AND expires_at>?",
        )
        .bind(hash, c.user.email.toLowerCase(), now)
        .first<any>();
      if (!invite)
        throw apiError(
          404,
          "This invitation is expired, used, revoked, or issued to a different email.",
        );
      if (invite.subject_id) {
        const linked = await c.binding
          .prepare(
            "SELECT user_id FROM memberships WHERE workspace_id=? AND role=? AND subject_id=? AND revoked_at IS NULL",
          )
          .bind(invite.workspace_id, invite.role, invite.subject_id)
          .first<any>();
        if (linked && linked.user_id !== c.user.userId)
          throw apiError(
            409,
            "This profile is already linked to another account. Ask the owner to revoke the earlier membership.",
          );
      }
      const id = `${invite.workspace_id}:${c.user.userId}`;
      await c.binding.batch([
        c.binding
          .prepare(
            "INSERT INTO memberships (id,workspace_id,user_id,name,email,role,subject_id,created_at,revoked_at) SELECT ?,workspace_id,?,?,?,role,subject_id,?,NULL FROM invitations WHERE token_hash=? AND claimed_by IS NULL AND revoked_at IS NULL AND expires_at>? AND email=? ON CONFLICT(id) DO UPDATE SET role=excluded.role,subject_id=excluded.subject_id,revoked_at=NULL,name=excluded.name,email=excluded.email",
          )
          .bind(
            id,
            c.user.userId,
            c.user.displayName,
            c.user.email,
            now,
            hash,
            now,
            c.user.email.toLowerCase(),
          ),
        c.binding
          .prepare(
            "UPDATE invitations SET claimed_by=? WHERE token_hash=? AND claimed_by IS NULL AND revoked_at IS NULL AND expires_at>? AND email=?",
          )
          .bind(c.user.userId, hash, now, c.user.email.toLowerCase()),
      ]);
      const claimed = await c.binding
        .prepare("SELECT claimed_by FROM invitations WHERE token_hash=?")
        .bind(hash)
        .first<any>();
      if (claimed?.claimed_by !== c.user.userId)
        throw apiError(409, "Invitation already claimed.");
      return Response.json({ workspaceId: invite.workspace_id });
    }
    if (c.access.role !== "owner")
      throw apiError(403, "Only the centre owner can manage membership.");
    if (b.action === "invite") {
      if (["student", "mentor"].includes(b.role)) {
        const kind = b.role === "student" ? "student" : "mentor";
        const subject = await c.binding
          .prepare(
            "SELECT id FROM records WHERE id=? AND workspace_id=? AND kind=?",
          )
          .bind(`${c.workspace.id}:${b.subjectId}`, c.workspace.id, kind)
          .first();
        if (!subject)
          throw apiError(
            400,
            "Save a learner or community mentor profile, then link it to the invitation.",
          );
        const linked = await c.binding
          .prepare(
            "SELECT id FROM memberships WHERE workspace_id=? AND subject_id=? AND role=? AND revoked_at IS NULL",
          )
          .bind(c.workspace.id, b.subjectId, b.role)
          .first();
        if (linked)
          throw apiError(
            409,
            "This profile is already linked. Revoke its existing membership first.",
          );
      }
      const token = [...crypto.getRandomValues(new Uint8Array(32))]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
      const id = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 48 * 3600000).toISOString();
      await c.binding
        .prepare(
          "INSERT INTO invitations (id,workspace_id,token_hash,email,role,subject_id,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          c.workspace.id,
          await digest(token),
          b.email.toLowerCase(),
          b.role,
          ["student", "mentor"].includes(b.role) ? b.subjectId : null,
          now,
          expiresAt,
        )
        .run();
      await audit(c, "invitation.created", id);
      return Response.json(
        { token, expiresAt },
        { headers: { "cache-control": "no-store" } },
      );
    }
    const table = b.action === "revoke-member" ? "memberships" : "invitations";
    await c.binding
      .prepare(`UPDATE ${table} SET revoked_at=? WHERE id=? AND workspace_id=?`)
      .bind(now, b.id, c.workspace.id)
      .run();
    await audit(c, b.action, b.id);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
