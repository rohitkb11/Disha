import { runtimeConfig, apiError, type getContext } from "./server";
import { paidLinkMatches } from "./payment-policy";

export async function razorpay(path: string, body?: unknown) {
  const config = runtimeConfig();
  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET)
    throw apiError(
      503,
      "Payments need the centre's Razorpay account configuration. No payment has been taken.",
    );
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${btoa(`${config.RAZORPAY_KEY_ID}:${config.RAZORPAY_KEY_SECRET}`)}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw apiError(
      502,
      "The payment provider could not complete this request. Retry or contact your centre.",
    );
  return (await response.json()) as any;
}
export async function reconcilePayment(
  c: Pick<Awaited<ReturnType<typeof getContext>>, "binding">,
  row: any,
) {
  const subscription = row.product_id === "centre_subscription";
  const p = await razorpay(
    `${subscription ? "subscriptions" : "payment_links"}/${encodeURIComponent(row.provider_id)}`,
  );
  let paid = false,
    expires = 0;
  if (subscription) {
    paid =
      p.id === row.provider_id &&
      p.notes?.disha_payment_id === row.id &&
      p.status === "active" &&
      p.paid_count > 0 &&
      Number(p.current_end) * 1000 > Date.now();
    expires = Number(p.current_end) * 1000;
  } else {
    paid = paidLinkMatches(p, row);
    expires =
      Date.now() + (row.product_id === "centre_month" ? 30 : 36500) * 86400000;
  }
  const now = new Date().toISOString();
  if (paid) {
    // A one-time purchase keeps its original expiry when replayed. Subscriptions track the provider period.
    await c.binding.batch([
      c.binding
        .prepare("UPDATE payments SET status='paid' WHERE id=?")
        .bind(row.id),
      c.binding
        .prepare(
          `INSERT INTO entitlements (id,workspace_id,user_id,product_id,payment_id,expires_at,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET expires_at=${subscription ? "excluded.expires_at" : "entitlements.expires_at"}`,
        )
        .bind(
          row.id,
          row.workspace_id,
          row.user_id,
          subscription ? "centre_month" : row.product_id,
          row.id,
          expires,
          now,
        ),
    ]);
  } else {
    await c.binding
      .prepare("UPDATE payments SET status=? WHERE id=?")
      .bind(String(p.status || "pending"), row.id)
      .run();
    if (
      subscription &&
      ["cancelled", "completed", "expired"].includes(p.status) &&
      (!p.current_end || Number(p.current_end) * 1000 <= Date.now())
    )
      await c.binding
        .prepare("DELETE FROM entitlements WHERE payment_id=?")
        .bind(row.id)
        .run();
  }
  return { status: paid ? "paid" : p.status, expiresAt: paid ? expires : null };
}
