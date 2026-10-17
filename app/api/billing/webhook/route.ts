import { getDb } from "@/db";
import { env } from "cloudflare:workers";
import { validSignature } from "@/lib/crypto";
import { reconcilePayment } from "@/lib/billing";
import { runtimeConfig, errorResponse, apiError } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const secret = runtimeConfig().RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw apiError(503, "Webhook not configured.");
    const raw = await request.text();
    if (raw.length > 524288) throw apiError(413, "Payload too large.");
    if (
      !(await validSignature(
        secret,
        raw,
        request.headers.get("x-razorpay-signature") || "",
      ))
    )
      throw apiError(401, "Invalid webhook signature.");
    let event: any;
    try {
      event = JSON.parse(raw);
    } catch {
      throw apiError(400, "Invalid payload.");
    }
    const entity =
      event.payload?.payment_link?.entity ||
      event.payload?.subscription?.entity;
    if (!entity?.id) return Response.json({ received: true });
    // Always reconcile against the provider API; signed event replay cannot extend one-time access.
    const binding = env.DB!;
    const row = await binding
      .prepare("SELECT * FROM payments WHERE provider_id=?")
      .bind(entity.id)
      .first<any>();
    if (row) await reconcilePayment({ binding }, row);
    return Response.json({ received: true });
  } catch (e) {
    return errorResponse(e);
  }
}
