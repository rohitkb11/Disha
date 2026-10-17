import { z } from "zod";
import {
  getContext,
  mutationGuard,
  readJson,
  errorResponse,
  apiError,
  rateLimit,
  runtimeConfig,
  audit,
} from "@/lib/server";
import { razorpay, reconcilePayment } from "@/lib/billing";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const c = await getContext(request);
    const payments = (
      await c.binding
        .prepare(
          "SELECT id,product_id AS productId,amount,currency,status,checkout_url AS checkoutUrl,created_at AS createdAt FROM payments WHERE workspace_id=? AND user_id=? ORDER BY created_at DESC LIMIT 50",
        )
        .bind(c.workspace.id, c.user.userId)
        .all()
    ).results;
    const entitlements = (
      await c.binding
        .prepare(
          "SELECT product_id AS productId,expires_at AS expiresAt FROM entitlements WHERE workspace_id=? AND user_id=? AND expires_at>?",
        )
        .bind(c.workspace.id, c.user.userId, Date.now())
        .all()
    ).results;
    const cfg = runtimeConfig();
    return Response.json(
      {
        payments,
        entitlements,
        configured: Boolean(cfg.RAZORPAY_KEY_ID && cfg.RAZORPAY_KEY_SECRET),
        testMode: cfg.RAZORPAY_KEY_ID?.startsWith("rzp_test_") || false,
        subscriptionConfigured: Boolean(cfg.RAZORPAY_MONTHLY_PLAN_ID),
        monthlyPassRupees: 199,
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
    const c = await getContext(request);
    await rateLimit(c, "billing", 10);
    const parsed = z
      .discriminatedUnion("action", [
        z.object({
          action: z.literal("checkout"),
          productId: z.string().max(150),
        }),
        z.object({ action: z.literal("reconcile"), id: z.string().uuid() }),
        z.object({
          action: z.literal("cancel-subscription"),
          id: z.string().uuid(),
        }),
      ])
      .safeParse(await readJson(request));
    if (!parsed.success) throw apiError(400, "Invalid payment request.");
    const b = parsed.data;
    if (b.action !== "checkout") {
      const row = await c.binding
        .prepare(
          "SELECT * FROM payments WHERE id=? AND workspace_id=? AND user_id=?",
        )
        .bind(b.id, c.workspace.id, c.user.userId)
        .first<any>();
      if (!row?.provider_id) throw apiError(404, "Payment not found.");
      if (b.action === "cancel-subscription") {
        if (row.product_id !== "centre_subscription")
          throw apiError(400, "This payment is not a subscription.");
        await razorpay(
          `subscriptions/${encodeURIComponent(row.provider_id)}/cancel`,
          { cancel_at_cycle_end: true },
        );
        await audit(c, "subscription.cancel-requested", row.id);
        return Response.json({ ok: true });
      }
      return Response.json(await reconcilePayment(c, row));
    }
    let amount = 19900;
    let title = "Disha centre access for 30 days (manual renewal)";
    const subscription = b.productId === "centre_subscription";
    if (subscription) {
      const planId = runtimeConfig().RAZORPAY_MONTHLY_PLAN_ID;
      if (!planId)
        throw apiError(
          503,
          "The centre has not configured a monthly subscription plan.",
        );
      const plan = await razorpay(`plans/${encodeURIComponent(planId)}`);
      if (
        plan.period !== "monthly" ||
        plan.interval !== 1 ||
        plan.item?.currency !== "INR"
      )
        throw apiError(503, "The centre's subscription plan needs review.");
      amount = plan.item.amount;
      title = plan.item.name;
    } else if (b.productId.startsWith("course_")) {
      const row = await c.binding
        .prepare(
          "SELECT data FROM records WHERE workspace_id=? AND id=? AND kind='course'",
        )
        .bind(c.workspace.id, `${c.workspace.id}:${b.productId.slice(7)}`)
        .first<any>();
      const course = row && JSON.parse(row.data);
      if (!course?.published || !(course.price > 0))
        throw apiError(404, "Paid module not found.");
      amount = Math.round(course.price * 100);
      title = course.title;
    } else if (b.productId !== "centre_month")
      throw apiError(400, "Unknown product.");
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100000000)
      throw apiError(400, "Invalid product price.");
    if (
      !runtimeConfig().RAZORPAY_KEY_ID ||
      !runtimeConfig().RAZORPAY_KEY_SECRET
    )
      throw apiError(
        503,
        "Payment collection is not configured. No payment has been taken.",
      );
    const product = subscription ? "centre_month" : b.productId;
    const grant = await c.binding
      .prepare(
        "SELECT id FROM entitlements WHERE workspace_id=? AND user_id=? AND product_id=? AND expires_at>?",
      )
      .bind(c.workspace.id, c.user.userId, product, Date.now())
      .first();
    if (grant)
      throw apiError(409, "You already have active access to this product.");
    await c.binding
      .prepare(
        "UPDATE payments SET status='expired' WHERE workspace_id=? AND user_id=? AND status IN ('created','creating') AND expires_at<=?",
      )
      .bind(c.workspace.id, c.user.userId, Date.now())
      .run();
    const existing = await c.binding
      .prepare(
        "SELECT * FROM payments WHERE workspace_id=? AND user_id=? AND product_id=? AND status IN ('created','creating') AND expires_at>? ORDER BY created_at DESC LIMIT 1",
      )
      .bind(c.workspace.id, c.user.userId, b.productId, Date.now())
      .first<any>();
    if (existing?.checkout_url)
      return Response.json({
        id: existing.id,
        url: existing.checkout_url,
        amount: existing.amount,
      });
    if (existing)
      throw apiError(
        409,
        "Your checkout is still being created. Retry shortly.",
      );
    const id = crypto.randomUUID();
    const expiresAt = Date.now() + 24 * 3600000;
    const inserted = await c.binding
      .prepare(
        "INSERT INTO payments (id,workspace_id,user_id,product_id,amount,currency,status,expires_at,created_at) VALUES (?,?,?,?,?,'INR','creating',?,?) ON CONFLICT DO NOTHING RETURNING id",
      )
      .bind(
        id,
        c.workspace.id,
        c.user.userId,
        b.productId,
        amount,
        expiresAt,
        new Date().toISOString(),
      )
      .first();
    if (!inserted)
      throw apiError(
        409,
        "Another checkout is being created. Refresh before retrying.",
      );
    try {
      const p = subscription
        ? await razorpay("subscriptions", {
            plan_id: runtimeConfig().RAZORPAY_MONTHLY_PLAN_ID,
            total_count: 12,
            quantity: 1,
            customer_notify: false,
            notes: { disha_payment_id: id },
          })
        : await razorpay("payment_links", {
            amount,
            currency: "INR",
            accept_partial: false,
            description: title.slice(0, 200),
            reference_id: id,
            expire_by: Math.floor(expiresAt / 1000),
            notify: { sms: false, email: false },
            reminder_enable: false,
            notes: { disha_payment_id: id },
          });
      if (!/^https:\/\//.test(p.short_url) || !p.id)
        throw new Error("Invalid checkout response");
      await c.binding
        .prepare(
          "UPDATE payments SET provider_id=?,checkout_url=?,status='created' WHERE id=?",
        )
        .bind(p.id, p.short_url, id)
        .run();
      await audit(c, "checkout.created", id);
      return Response.json({
        id,
        url: p.short_url,
        amount,
        currency: "INR",
        subscription,
      });
    } catch (e) {
      await c.binding
        .prepare("UPDATE payments SET status='failed' WHERE id=?")
        .bind(id)
        .run();
      throw e;
    }
  } catch (e) {
    return errorResponse(e);
  }
}
