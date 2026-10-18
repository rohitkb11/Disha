import { z } from "zod";
import {
  getContext,
  readJson,
  errorResponse,
  apiError,
  runtimeConfig,
  rateLimit,
  audit,
} from "@/lib/server";
import { safeHttps, isFacilitator } from "@/lib/access";
import { digest } from "@/lib/crypto";
import { OPPORTUNITIES } from "@/lib/catalog";
import { readBoundedText } from "@/lib/http";
export const dynamic = "force-dynamic";
const item = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(190),
  provider: z.string().min(1).max(150),
  type: z.enum([
    "Scholarship",
    "Training",
    "Apprenticeship",
    "Mentorship",
    "Experience",
  ]),
  description: z.string().min(1).max(4000),
  source: z.string().url().refine(safeHttps),
  location: z.string().max(150),
  verifiedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (s) => Number.isFinite(Date.parse(s)) && Date.parse(s) <= Date.now(),
    ),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  benefit: z.string().max(500).optional(),
  documents: z.array(z.string().max(200)).max(20).optional(),
});
export async function POST(request: Request) {
  try {
    // Consume this request's bounded body before asynchronous authorization.
    // workerd may otherwise close an unread stream on a rejected keep-alive request.
    const input = await readJson(request);
    const c = await getContext(request);
    if (!isFacilitator(c.access))
      throw apiError(403, "Only centre facilitators can import opportunities.");
    await rateLimit(c, "feed", 4);
    const b = z
      .discriminatedUnion("action", [
        z.object({ action: z.literal("refresh") }),
        z.object({
          action: z.literal("import"),
          items: z.array(item).min(1).max(100),
        }),
      ])
      .safeParse(input);
    if (!b.success)
      throw apiError(
        400,
        "Import needs 1–100 valid listings with HTTPS source links, provider names and actual source-check dates.",
      );
    const now = new Date().toISOString();
    let items = b.data.action === "import" ? b.data.items : [];
    let checked = 0;
    if (b.data.action === "refresh") {
      const results = await Promise.allSettled(
        OPPORTUNITIES.filter((o) => !o.sample).map(async (o) => {
          const r = await fetch(o.source, {
            method: "GET",
            redirect: "manual",
            signal: AbortSignal.timeout(8000),
            headers: { "user-agent": "Disha/1.0 (source availability check)" },
          });
          await r.body?.cancel();
          return r.status >= 200 && r.status < 400;
        }),
      );
      checked = results.filter(
        (r) => r.status === "fulfilled" && r.value,
      ).length;
      const config = runtimeConfig();
      if (config.DISHA_PARTNER_FEED_URL) {
        if (!safeHttps(config.DISHA_PARTNER_FEED_URL))
          throw apiError(503, "The configured feed must use HTTPS.");
        const response = await fetch(config.DISHA_PARTNER_FEED_URL, {
          headers: config.DISHA_PARTNER_FEED_TOKEN
            ? { authorization: `Bearer ${config.DISHA_PARTNER_FEED_TOKEN}` }
            : {},
          redirect: "error",
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok)
          throw apiError(
            502,
            `Official source checks completed (${checked} reachable). The partner feed is unavailable; existing data is retained.`,
          );
        const raw = await readBoundedText(response, 250000, 502, "Partner feed exceeds the size limit.");
        let parsed;
        try {
          parsed = z.array(item).max(100).safeParse(JSON.parse(raw));
        } catch {
          throw apiError(502, "Partner feed is not valid JSON.");
        }
        if (!parsed.success)
          throw apiError(
            502,
            "Partner feed failed validation. Existing records are retained.",
          );
        items = parsed.data;
      }
    }
    const writes = [];
    for (const o of items) {
      const id = `feed_${(await digest(`${o.provider}:${o.id}:${o.source}`)).slice(0, 32)}`;
      const data = {
        ...o,
        id,
        benefit: o.benefit || "Confirm terms with provider",
        documents: o.documents || ["Check the provider's current requirements"],
        criteria: [],
        sample: false,
        color: "mint",
        interests: [],
        sourceLabel: "Provider listing · confirm current requirements",
        refreshedAt: now,
        provenance:
          b.data.action === "import"
            ? "Facilitator-imported provider export"
            : "Configured partner feed",
        intake: "external",
      };
      writes.push(
        c.binding
          .prepare(
            "INSERT INTO records (id,workspace_id,kind,data,updated_at,revision,last_event) VALUES (?,?,'opportunity',?,?,1,'feed') ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at,revision=records.revision+1,last_event='feed'",
          )
          .bind(
            `${c.workspace.id}:${id}`,
            c.workspace.id,
            JSON.stringify(data),
            now,
          ),
      );
    }
    if (writes.length) await c.binding.batch(writes);
    await audit(c, "opportunities.refreshed", String(items.length));
    return Response.json({
      message: `${items.length} provider listings imported. ${b.data.action === "refresh" ? `${checked} official directories responded to a source check. ` : ""}Eligibility and availability must still be confirmed with each provider.`,
      imported: items.length,
      checkedAt: now,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
