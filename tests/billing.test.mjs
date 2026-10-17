import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import {
  reconcileReceipt,
  pilotConfiguration,
} from "../.sites-runtime/test-domain.mjs";
const now = Date.parse("2026-10-17T12:00:00Z");
const time = Math.floor(now / 1000);
function fixture(product = "centre_month") {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    db.exec(readFileSync(`drizzle/${file}`, "utf8"));
  db.prepare(
    "INSERT INTO workspaces(id,owner_id,name,created_at) VALUES ('w','u','Test',?)",
  ).run(new Date(now).toISOString());
  const row = {
    id: "receipt",
    workspace_id: "w",
    user_id: "u",
    product_id: product,
    amount: 19900,
    currency: "INR",
    status: "created",
    provider_id: product === "centre_subscription" ? "sub_1" : "plink_1",
    created_at: new Date(now - 3600000).toISOString(),
  };
  db.prepare(
    "INSERT INTO payments(id,workspace_id,user_id,product_id,amount,currency,status,provider_id,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
  ).run(
    row.id,
    row.workspace_id,
    row.user_id,
    row.product_id,
    row.amount,
    row.currency,
    row.status,
    row.provider_id,
    now + 86400000,
    row.created_at,
  );
  const binding = {
    prepare(sql) {
      let args = [];
      return {
        bind(...a) {
          args = a;
          return this;
        },
        async first() {
          return db.prepare(sql).get(...args) || null;
        },
        run() {
          return db.prepare(sql).run(...args);
        },
      };
    },
    async batch(statements) {
      db.exec("BEGIN");
      try {
        for (const s of statements) s.run();
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const link = {
    id: "plink_1",
    reference_id: "receipt",
    amount: 19900,
    amount_paid: 19900,
    status: "paid",
    currency: "INR",
    order_id: "order_1",
    payments: [{ payment_id: "pay_1", status: "captured" }],
  };
  const capture = {
    id: "pay_1",
    amount: 19900,
    currency: "INR",
    order_id: "order_1",
    status: "captured",
    captured: true,
    amount_refunded: 0,
    refund_status: null,
    created_at: time - 1800,
  };
  const sub = {
    id: "sub_1",
    notes: { disha_payment_id: "receipt" },
    status: "active",
    paid_count: 1,
    current_start: time - 1800,
    current_end: time + 29 * 86400,
  };
  let outage = false;
  const provider = async (path) => {
    if (outage) throw Error("Provider unavailable");
    if (path === "payment_links/plink_1") return structuredClone(link);
    if (path === "payments/pay_1") return structuredClone(capture);
    if (path === "subscriptions/sub_1") return structuredClone(sub);
    throw Error(`Unexpected provider call ${path}`);
  };
  return {
    db,
    binding,
    row,
    link,
    capture,
    sub,
    provider,
    setOutage() {
      outage = true;
    },
    grant() {
      return db.prepare("SELECT * FROM entitlements").get();
    },
    async reconcile(at = now) {
      return reconcileReceipt(binding, row, provider, at);
    },
  };
}
test("all immutable migrations apply to an empty SQLite database", () => {
  const f = fixture();
  assert.equal(
    f.db.prepare("SELECT COUNT(*) AS n FROM pilot_checks").get().n,
    0,
  );
  f.db.close();
});
test("one-time expiry starts at provider payment time; replay returns the stored expiry", async () => {
  const f = fixture();
  const first = await f.reconcile();
  assert.equal(first.expiresAt, (time - 1800) * 1000 + 30 * 86400000);
  assert.equal((await f.reconcile(now + 86400000)).expiresAt, first.expiresAt);
  assert.equal(
    f.db.prepare("SELECT provider_payment_id FROM payments").get()
      .provider_payment_id,
    "pay_1",
  );
  f.db.close();
});
test("late confirmation cannot revive a pass whose paid 30 days have expired", async () => {
  const f = fixture();
  const r = await f.reconcile(now + 31 * 86400000);
  assert.equal(r.status, "expired");
  assert.equal(r.expiresAt, null);
  assert.equal(f.grant(), undefined);
  f.db.close();
});
test("fully refunded captures revoke access and stale paid replies cannot regrant it", async () => {
  const f = fixture();
  await f.reconcile();
  f.capture.amount_refunded = 19900;
  f.capture.status = "refunded";
  assert.equal((await f.reconcile()).status, "refunded");
  assert.equal(f.grant(), undefined);
  f.capture.amount_refunded = 0;
  f.capture.status = "captured";
  const replay = await f.reconcile();
  assert.equal(replay.status, "refunded");
  assert.equal(replay.expiresAt, null);
  f.db.close();
});
test("partial refunds suspend this receipt for merchant review without revoking another purchase", async () => {
  const f = fixture();
  await f.reconcile();
  f.db.exec(
    "INSERT INTO payments(id,workspace_id,user_id,product_id,amount,currency,status,expires_at,created_at) VALUES ('other_receipt','w','u','course_other',100,'INR','paid',0,'now')",
  );
  f.db
    .prepare(
      "INSERT INTO entitlements(id,workspace_id,user_id,product_id,payment_id,expires_at,created_at) VALUES ('other','w','u','course_other','other_receipt',?,'now')",
    )
    .run(now + 86400000);
  f.capture.amount_refunded = 500;
  f.capture.refund_status = "partial";
  assert.equal((await f.reconcile()).status, "partially-refunded");
  assert.equal(
    f.db
      .prepare(
        "SELECT COUNT(*) AS n FROM entitlements WHERE payment_id='receipt'",
      )
      .get().n,
    0,
  );
  assert.ok(
    f.db
      .prepare("SELECT id FROM entitlements WHERE payment_id='other_receipt'")
      .get(),
  );
  f.db.close();
});
test("provider failure preserves the existing paid period and never fabricates a confirmation", async () => {
  const f = fixture();
  await f.reconcile();
  const expires = f.grant().expires_at;
  f.setOutage();
  await assert.rejects(f.reconcile(), /unavailable/);
  assert.equal(f.grant().expires_at, expires);
  f.db.close();
});
test("mismatched capture references and unverified timestamps never unlock content", async () => {
  for (const patch of [
    { amount: 1 },
    { order_id: "order_other" },
    { created_at: time + 9999 },
    { captured: false },
    { id: "pay_other" },
  ]) {
    const f = fixture();
    Object.assign(f.capture, patch);
    await assert.rejects(f.reconcile());
    assert.equal(f.grant(), undefined);
    f.db.close();
  }
});
test("paid-link metadata alone cannot unlock a module without verified captured payment", async () => {
  const f = fixture();
  f.link.payments = [];
  await assert.rejects(f.reconcile(), /details/);
  assert.equal(f.grant(), undefined);
  f.db.close();
});
test("subscription access needs an active paid, current bounded period", async () => {
  for (const patch of [
    { paid_count: 0 },
    { status: "authenticated" },
    { current_start: time + 1 },
    { current_end: time + 365 * 86400 },
    { current_end: time - 1 },
  ]) {
    const f = fixture("centre_subscription");
    Object.assign(f.sub, patch);
    assert.equal((await f.reconcile()).expiresAt, null);
    assert.equal(f.grant(), undefined);
    f.db.close();
  }
});
test("subscription cancellation/completion retains only an already verified paid period", async () => {
  for (const status of ["cancelled", "completed"]) {
    const f = fixture("centre_subscription");
    const first = await f.reconcile();
    f.sub.status = status;
    f.sub.current_end = null;
    assert.equal((await f.reconcile()).expiresAt, first.expiresAt);
    assert.equal((await f.reconcile(first.expiresAt + 1)).expiresAt, null);
    assert.equal(f.grant(), undefined);
    f.db.close();
  }
});
test("a cancelled subscription cannot create access without a prior verified paid grant", async () => {
  const f = fixture("centre_subscription");
  f.sub.status = "cancelled";
  assert.equal((await f.reconcile()).expiresAt, null);
  assert.equal(f.grant(), undefined);
  f.db.close();
});
test("renewal cannot extend access until the provider confirms a new paid period", async () => {
  const f = fixture("centre_subscription");
  const first = await f.reconcile();
  f.sub.status = "halted";
  f.sub.current_end += 30 * 86400;
  assert.equal((await f.reconcile()).expiresAt, first.expiresAt);
  f.sub.status = "active";
  f.sub.current_start = time;
  f.sub.paid_count = 2;
  assert.ok((await f.reconcile()).expiresAt > first.expiresAt);
  f.db.close();
});
test("readiness checks expose presence only and do not confuse a webhook secret with merchant credentials", () => {
  const checks = pilotConfiguration({
    RAZORPAY_WEBHOOK_SECRET: "never-return-this",
  });
  assert.equal(checks.find((c) => c.id === "payments").configured, false);
  assert.equal(JSON.stringify(checks).includes("never-return-this"), false);
});
