import assert from "node:assert/strict";
const base = process.env.DISHA_TEST_URL || "http://127.0.0.1:5173";
const anonymous = await fetch(`${base}/api/state`);
assert.equal(anonymous.status, 401, "anonymous state access must be rejected");
const spoof = await fetch(`${base}/api/state`, {
  headers: {
    "oai-authenticated-user-id": "not-a-real-user",
    "oai-authenticated-user-email": "nobody@example.test",
  },
});
assert.equal(
  spoof.status,
  401,
  "local dispatch must strip spoofed identity headers",
);
const login = await fetch(`${base}/signin-with-chatgpt?return_to=/`, {
  redirect: "manual",
});
const cookie = login.headers
  .getSetCookie()
  .map((v) => v.split(";")[0])
  .join("; ");
assert.ok(cookie, "local preview must supply its development identity cookie");
const headers = { "content-type": "application/json", cookie, origin: base };
const initialResponse = await fetch(`${base}/api/state`, {
  headers: { cookie },
});
assert.equal(initialResponse.status, 200);
const initial = await initialResponse.json();
const id = `qa_${crypto.randomUUID()}`;
const student = {
  id,
  profile: {
    name: "QA learner",
    age: 18,
    grade: "12",
    district: "Test district",
    state: "Maharashtra",
    language: "en",
    interests: ["Art & design"],
    goals: "Test a career pathway",
    budget: 1000,
    hours: 3,
    income: null,
    education: 12,
    canTravel: false,
    completed: true,
  },
  savedCareers: [],
  createdAt: new Date().toISOString(),
  sample: true,
};
function event(data, revision, eventId = crypto.randomUUID()) {
  return {
    id: eventId,
    baseRevision: revision,
    queuedAt: new Date().toISOString(),
    record: { id, kind: "student", data, updatedAt: new Date().toISOString() },
  };
}
async function sync(events, extraHeaders = {}) {
  return fetch(`${base}/api/sync`, {
    method: "POST",
    headers: { ...headers, ...extraHeaders },
    body: JSON.stringify({ events }),
  });
}
const first = event(student, 0);
assert.equal(
  (await sync([first], { origin: "https://untrusted.example" })).status,
  403,
);
assert.equal(
  (
    await sync([
      { ...first, record: { ...first.record, id: "../other-workspace" } },
    ])
  ).status,
  400,
);
let response = await sync([first]);
assert.equal(response.status, 200);
let result = await response.json();
assert.deepEqual(result.acknowledged, [first.id]);
assert.equal(result.revisions[id], 1);
response = await sync([first]);
result = await response.json();
assert.deepEqual(result.acknowledged, [first.id]);
assert.equal(
  result.revisions[id],
  1,
  "replay must not duplicate or increment the record",
);
const updated = {
  ...student,
  profile: { ...student.profile, goals: "Updated by the first device" },
};
response = await sync([event(updated, 1)]);
result = await response.json();
assert.equal(result.revisions[id], 2);
response = await sync([
  event(
    {
      ...student,
      profile: { ...student.profile, goals: "Stale second-device edit" },
    },
    1,
  ),
]);
result = await response.json();
assert.equal(result.conflicts.length, 1);
assert.equal(result.conflicts[0].record.revision, 2);
assert.equal(
  result.conflicts[0].record.data.profile.goals,
  "Updated by the first device",
);
const finalState = await (
  await fetch(`${base}/api/state`, { headers: { cookie } })
).json();
assert.equal(finalState.workspace.id, initial.workspace.id);
assert.equal(
  finalState.records.find((r) => r.id === id).data.profile.goals,
  "Updated by the first device",
);
console.log(
  "PASS: anonymous and spoofed access, origin guard, input validation, durable writes, idempotent replay, and conflict protection.",
);
if (process.env.DISHA_TEST_AI === "1") {
  const guide = await fetch(`${base}/api/guide`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      studentId: id,
      message:
        "How can I explore a career in graphic design? Give one next step.",
      language: "en",
    }),
  });
  assert.equal(guide.status, 200);
  const result = await guide.json();
  assert.ok(result.answer.length > 30);
  assert.ok(result.sources.length);
  console.log(
    `PASS: guide returned ${result.mode} response with ${result.sources.length} sources.`,
  );
}
console.log(`Disposable QA record: ${id}`);
