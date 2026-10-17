import { paidLinkMatches } from "./payment-policy";

export type ProviderRead = (path: string) => Promise<any>;
type Binding = Pick<D1Database, "prepare" | "batch">;
// Read-only provider reconciliation: this module never creates a charge or refund.
export async function reconcileReceipt(
  binding: Binding,
  row: any,
  provider: ProviderRead,
  now = Date.now(),
) {
  const subscription = row.product_id === "centre_subscription";
  const existing = await binding
    .prepare("SELECT expires_at FROM entitlements WHERE payment_id=?")
    .bind(row.id)
    .first<{ expires_at: number }>();
  const p = await provider(
    `${subscription ? "subscriptions" : "payment_links"}/${encodeURIComponent(row.provider_id)}`,
  );
  if (
    p.id !== row.provider_id ||
    (subscription
      ? p.notes?.disha_payment_id !== row.id
      : p.reference_id !== row.id)
  )
    throw new Error("Provider receipt reference mismatch");
  let status = typeof p.status === "string" ? p.status : "pending";
  let expires = existing?.expires_at || 0;
  let grant = false;
  let revoke = false;
  let paymentId: string | null = null;
  if (subscription) {
    const start = Number(p.current_start) * 1000;
    const end = Number(p.current_end) * 1000;
    const validPeriod =
      Number.isSafeInteger(start) &&
      Number.isSafeInteger(end) &&
      start > 0 &&
      start <= now &&
      end > start &&
      end - start <= 62 * 86400000;
    if (
      p.status === "active" &&
      Number.isSafeInteger(p.paid_count) &&
      p.paid_count > 0 &&
      validPeriod &&
      end > now
    ) {
      expires = end;
      grant = true;
      status = "paid";
    } else if (existing) {
      // Cancellation/completion cannot invent a new paid period. Preserve only the
      // already verified period, bounded by an authoritative shortened period.
      if (validPeriod) expires = Math.min(expires, end);
      revoke = expires <= now;
    }
  } else if (paidLinkMatches(p, row)) {
    // accept_partial=false at creation: exactly one captured payment is required.
    if (
      !Array.isArray(p.payments) ||
      p.payments.length !== 1 ||
      !/^pay_[A-Za-z0-9]+$/.test(p.payments[0]?.payment_id || "")
    )
      throw new Error("Provider capture details unavailable");
    paymentId = p.payments[0].payment_id;
    const payment = await provider(
      `payments/${encodeURIComponent(paymentId!)}`,
    );
    if (
      payment.id !== paymentId ||
      payment.currency !== row.currency ||
      payment.amount !== row.amount ||
      (p.order_id && payment.order_id !== p.order_id)
    )
      throw new Error("Provider capture amount or reference mismatch");
    if (
      payment.status === "refunded" ||
      payment.refund_status === "full" ||
      payment.amount_refunded === row.amount
    ) {
      status = "refunded";
      revoke = true;
    } else if (
      Number.isSafeInteger(payment.amount_refunded) &&
      payment.amount_refunded > 0
    ) {
      status = "partially-refunded";
      revoke = true;
    } else if (
      payment.status === "captured" &&
      payment.captured === true &&
      payment.amount_refunded === 0 &&
      !payment.refund_status
    ) {
      const capturedAt = Number(payment.created_at) * 1000;
      if (
        !Number.isSafeInteger(capturedAt) ||
        capturedAt <= 0 ||
        capturedAt > now + 300000 ||
        capturedAt < Date.parse(row.created_at) - 300000
      )
        throw new Error("Provider capture timestamp invalid");
      const providerExpiry =
        capturedAt +
        (row.product_id === "centre_month" ? 30 : 36500) * 86400000;
      expires = existing
        ? Math.min(existing.expires_at, providerExpiry)
        : providerExpiry;
      grant = expires > now;
      revoke = !grant;
      status = grant ? "paid" : "expired";
    } else {
      throw new Error("Provider capture not verified");
    }
  } else if (p.status === "paid") {
    throw new Error("Provider paid-link amount or currency mismatch");
  } else if (existing) {
    // A previously granted one-time link that is no longer paid cannot retain access.
    revoke = true;
  }
  const writes = [
    binding
      .prepare(
        "UPDATE payments SET status=CASE WHEN status='refunded' THEN status WHEN status='partially-refunded' AND ? NOT IN ('refunded','partially-refunded') THEN status ELSE ? END,provider_payment_id=COALESCE(?,provider_payment_id) WHERE id=?",
      )
      .bind(status, status, paymentId, row.id),
  ];
  if (grant)
    writes.push(
      binding
        .prepare(
          "INSERT INTO entitlements (id,workspace_id,user_id,product_id,payment_id,expires_at,created_at) SELECT ?,?,?,?,?,?,? FROM payments WHERE id=? AND status='paid' ON CONFLICT(id) DO UPDATE SET expires_at=excluded.expires_at",
        )
        .bind(
          row.id,
          row.workspace_id,
          row.user_id,
          subscription ? "centre_month" : row.product_id,
          row.id,
          expires,
          new Date(now).toISOString(),
          row.id,
        ),
    );
  else if (revoke)
    writes.push(
      binding
        .prepare("DELETE FROM entitlements WHERE payment_id=?")
        .bind(row.id),
    );
  else if (existing && expires !== existing.expires_at)
    writes.push(
      binding
        .prepare("UPDATE entitlements SET expires_at=? WHERE payment_id=?")
        .bind(expires, row.id),
    );
  await binding.batch(writes);
  const actual = await binding
    .prepare(
      "SELECT expires_at FROM entitlements WHERE payment_id=? AND expires_at>?",
    )
    .bind(row.id, now)
    .first<{ expires_at: number }>();
  const receipt = await binding
    .prepare("SELECT status FROM payments WHERE id=?")
    .bind(row.id)
    .first<{ status: string }>();
  return {
    status: receipt?.status || status,
    expiresAt: actual?.expires_at || null,
  };
}
