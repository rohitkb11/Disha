import { env } from "cloudflare:workers";
import { validSignature } from "@/lib/crypto";
import { reconcilePayment } from "@/lib/billing";
import { runtimeConfig, errorResponse, apiError } from "@/lib/server";
import { readBoundedText } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const raw = await readBoundedText(request);
    const secret = runtimeConfig().RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw apiError(503, "Webhook not configured.");
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
    if (!event || typeof event !== "object")
      throw apiError(400, "Invalid event.");
    const entity =
      event.payload?.payment_link?.entity ||
      event.payload?.subscription?.entity;
    // Always reconcile against the provider API; signed event replay cannot extend one-time access.
    const binding = env.DB!;
    // Refund events refer to the captured payment, not the hosted link.
    // This mapping is written only after verifying the provider's own link/capture.
    const captured =
      event.payload?.refund?.entity?.payment_id ||
      event.payload?.payment?.entity?.id;
    const row = await binding
      .prepare(
        "SELECT * FROM payments WHERE provider_id=? OR provider_payment_id=?",
      )
      .bind(entity?.id || "", typeof captured === "string" ? captured : "")
      .first<any>();
    if (row) await reconcilePayment({ binding }, row);
    return Response.json({ received: true });
  } catch (e) {
    return errorResponse(e);
  }
}
