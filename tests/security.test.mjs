import test from "node:test";
import assert from "node:assert/strict";
import {
  canReadRecord,
  canWriteRecord,
  canAccessStudent,
  hmac,
  validSignature,
  generateGuidance,
  parseGroundedAnswer,
  redactContact,
  paidLinkMatches,
  COURSES,
} from "../.sites-runtime/test-domain.mjs";
const access = (role, subjectId = null) => ({
  role,
  subjectId,
  userId: "actor",
});
const record = (kind, id, data = {}) => ({
  kind,
  id,
  data,
  updatedAt: "2026-10-17T10:00:00Z",
});
test("linked learners cannot read other learners, notes or rewrite another learner's progress", () => {
  const a = access("student", "learner_a");
  assert.equal(canReadRecord(a, record("student", "learner_a", {})), true);
  assert.equal(canReadRecord(a, record("student", "learner_b", {})), false);
  assert.equal(
    canReadRecord(a, record("note", "note_a", { studentId: "learner_a" })),
    false,
  );
  assert.equal(
    canWriteRecord(
      a,
      record("progress", "p", { studentId: "learner_a" }),
      record("progress", "p", { studentId: "learner_b" }),
    ),
    false,
  );
  assert.equal(
    canWriteRecord(a, record("assignment", "x", { studentId: "learner_a" })),
    false,
  );
  assert.equal(canAccessStudent(a, "learner_b"), false);
});
test("mentor/employer roles cannot read student profiles or mutate other partner opportunities", () => {
  for (const role of ["mentor", "employer"])
    assert.equal(
      canReadRecord(access(role), record("student", "learner_a")),
      false,
    );
  assert.equal(
    canWriteRecord(
      access("employer"),
      record("opportunity", "job", { partnerUserId: "actor" }),
      record("opportunity", "job", { partnerUserId: "other" }),
    ),
    false,
  );
  assert.equal(
    canWriteRecord(access("mentor", "mentor_a"), record("mentor", "mentor_b")),
    false,
  );
  assert.equal(canWriteRecord(access("teacher"), record("course", "c")), true);
});
test("every bundled lesson has matching Hindi and Marathi assessments", () => {
  assert.equal(
    COURSES.reduce((n, c) => n + c.lessons.length, 0),
    16,
  );
  for (const c of COURSES)
    for (const lesson of c.lessons)
      for (const lang of ["hi", "mr"]) {
        assert.ok(lesson[lang]?.text.length > 30, `${c.id}: missing ${lang}`);
        assert.equal(lesson[lang].options.length, lesson.options.length);
        assert.ok(lesson[lang].options[lesson.correct]);
      }
});
test("signed callbacks reject altered payloads, wrong secrets and malformed signatures", async () => {
  const signature = await hmac("test-secret", '{"event":"paid"}');
  assert.equal(
    await validSignature("test-secret", '{"event":"paid"}', signature),
    true,
  );
  assert.equal(
    await validSignature("test-secret", '{"event":"forged"}', signature),
    false,
  );
  assert.equal(
    await validSignature("wrong-secret", '{"event":"paid"}', signature),
    false,
  );
  assert.equal(await validSignature("test-secret", "x", "bad"), false);
});
test("payment status alone cannot grant access: references, amount and currency must match", () => {
  const row = { id: "receipt", provider_id: "plink_1", amount: 19900 };
  const p = {
    id: "plink_1",
    reference_id: "receipt",
    status: "paid",
    currency: "INR",
    amount: 19900,
    amount_paid: 19900,
  };
  assert.equal(paidLinkMatches(p, row), true);
  for (const patch of [
    { currency: "USD" },
    { amount_paid: 1 },
    { reference_id: "different" },
    { id: "other" },
    { status: "created" },
    { amount: 1 },
  ])
    assert.equal(paidLinkMatches({ ...p, ...patch }, row), false);
});
const sources = [
  {
    title: "Career exploration",
    text: "Try a small design activity and discuss it with a facilitator.",
    url: "https://www.ncs.gov.in/",
  },
];
test("AI answer validation rejects invented source IDs, money claims and external links", () => {
  assert.ok(
    parseGroundedAnswer(
      JSON.stringify({
        answer: "Try a small design activity and discuss your experience.",
        sourceIds: [1],
      }),
      sources,
    ),
  );
  for (const data of [
    { answer: "You will earn ₹50000 guaranteed.", sourceIds: [1] },
    {
      answer: "Read https://untrusted.example/apply for a guaranteed grant.",
      sourceIds: [1],
    },
    { answer: "Useful guidance here.", sourceIds: [9] },
  ])
    assert.equal(parseGroundedAnswer(JSON.stringify(data), sources), null);
  assert.equal(
    parseGroundedAnswer("unstructured hallucination", sources),
    null,
  );
});
test("provider adapter sends minimum profile data, cites real references and falls back on outages", async () => {
  let outgoing;
  const fake = async (url, init) => {
    outgoing = JSON.parse(init.body);
    assert.ok(url.startsWith("https://api.cloudflare.com/"));
    return Response.json({
      result: {
        response: JSON.stringify({
          answer:
            "Try a design activity, then discuss it with your facilitator.",
          sourceIds: [1],
        }),
      },
    });
  };
  const config = {
    model: "qwen2.5:1.5b",
    cloudModel: "@cf/qwen/qwen3-30b-a3b-fp8",
    account: "test-account",
    token: "test-token",
  };
  const result = await generateGuidance(
    config,
    "Contact me at learner@example.test",
    "en",
    {
      interests: ["Art"],
      education: 10,
      goals: "Call 9876543210",
      name: "Private Name",
      income: 100,
    },
    sources,
    fake,
  );
  assert.equal(result.mode, "cloudflare");
  const body = JSON.stringify(outgoing);
  for (const value of [
    "Private Name",
    "income",
    "learner@example.test",
    "9876543210",
  ])
    assert.equal(body.includes(value), false);
  assert.equal(
    await generateGuidance(
      config,
      "What next?",
      "en",
      { interests: [], education: 10, goals: "" },
      sources,
      async () => new Response("Unavailable", { status: 503 }),
    ),
    null,
  );
  assert.equal(
    await generateGuidance(
      config,
      "What next?",
      "en",
      { interests: [], education: 10, goals: "" },
      sources,
      async () => {
        throw new Error("offline");
      },
    ),
    null,
  );
});
