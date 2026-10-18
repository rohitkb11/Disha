// Application authorization tests against the LOCAL built Worker only.
// These headers emulate Sites dispatch and must never be used against a hosted Site.
import assert from "node:assert/strict";
const base = process.env.DISHA_ROLE_TEST_URL || "http://127.0.0.1:5174";
assert.ok(
  /^http:\/\/127\.0\.0\.1:\d+$/.test(base),
  "Role fixtures are restricted to loopback.",
);
const run = crypto.randomUUID().slice(0, 8);
const users = Object.fromEntries(
  ["owner", "student", "teacher", "mentor", "employer", "stranger"].map(
    (role) => [
      role,
      { id: `qa_${run}_${role}`, email: `qa_${run}_${role}@example.test` },
    ],
  ),
);
let ws;
let checks = 0;
async function call(role, path, body, expected = 200, workspace = ws) {
  // Give the local workerd inspector time to drain between fixture mutations.
  await new Promise((resolve) => setTimeout(resolve, 75));
  const u = users[role];
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "oai-authenticated-user-id": u.id,
      "oai-authenticated-user-email": u.email,
      "content-type": "application/json",
      origin: base,
      ...(workspace ? { "x-disha-workspace": workspace } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  assert.ok(
    response.headers.get("content-type")?.includes("json"),
    `${role} ${path} returned ${response.status}: ${raw.slice(0, 500)}`,
  );
  const data = JSON.parse(raw);
  assert.equal(
    response.status,
    expected,
    `${role} ${path}: ${JSON.stringify(data)}`,
  );
  checks++;
  return data;
}
const initial = await call("owner", "/api/state");
ws = initial.workspace.id;
for (const [contentType, body, expected] of [
  ["application/jsonp", "{}", 415],
  ["application/json", JSON.stringify({ text: "द".repeat(180000) }), 413],
  ["application/json", "{", 400],
]) {
  await new Promise((resolve) => setTimeout(resolve, 75));
  const response = await fetch(base + "/api/opportunity-feed", {
    method: "POST",
    headers: {
      "oai-authenticated-user-id": users.owner.id,
      "oai-authenticated-user-email": users.owner.email,
      "x-disha-workspace": ws,
      origin: base,
      "content-type": contentType,
    },
    body,
  });
  assert.equal(response.status, expected);
  assert.ok((await response.json()).error);
  checks++;
}
// A rejected/oversized body must not break the next keep-alive request.
await call("owner", "/api/state");
const learner = "learner_a",
  other = "learner_b",
  mentor = "mentor_profile";
const profile = {
  name: "QA learner",
  age: 18,
  grade: "12",
  district: "Test district",
  state: "Maharashtra",
  language: "en",
  interests: ["Technology"],
  goals: "Explore work",
  budget: null,
  hours: 3,
  canTravel: false,
  education: 12,
  income: null,
  completed: true,
};
function event(kind, id, data, baseRevision = 0) {
  return {
    id: crypto.randomUUID(),
    baseRevision,
    queuedAt: new Date().toISOString(),
    record: { kind, id, data, updatedAt: new Date().toISOString() },
  };
}
async function save(role, kind, id, data, expected = 200, revision = 0) {
  return call(
    role,
    "/api/sync",
    { events: [event(kind, id, data, revision)] },
    expected,
  );
}
await save("owner", "student", learner, {
  id: learner,
  profile,
  savedCareers: [],
  createdAt: new Date().toISOString(),
});
await save("owner", "student", other, {
  id: other,
  profile: { ...profile, name: "Other learner" },
  savedCareers: [],
  createdAt: new Date().toISOString(),
});
await save("owner", "mentor", mentor, {
  id: mentor,
  name: "QA mentor",
  title: "Designer",
  organization: "QA centre",
  languages: ["English"],
  expertise: ["Design"],
  bio: "Test mentor",
  initials: "QM",
  sample: false,
  color: "mint",
});
await save("owner", "note", "private_note", {
  studentId: learner,
  text: "Facilitator-only note",
});
for (const role of ["student", "teacher", "mentor", "employer"]) {
  const invite = await call("owner", "/api/team", {
    action: "invite",
    email: users[role].email,
    role,
    subjectId: role === "student" ? learner : role === "mentor" ? mentor : null,
  });
  if (role === "student")
    await call(
      "stranger",
      "/api/team",
      { action: "join", token: invite.token },
      404,
      null,
    );
  await call(
    role,
    "/api/team",
    { action: "join", token: invite.token },
    200,
    null,
  );
  await call(
    role,
    "/api/team",
    { action: "join", token: invite.token },
    404,
    null,
  );
}
const student = await call("student", "/api/state");
assert.equal(student.access.role, "student");
assert.equal(student.records.filter((r) => r.kind === "student").length, 1);
assert.equal(
  student.records.some((r) => r.kind === "note"),
  false,
);
await call("stranger", "/api/state", undefined, 403);
await call(
  "teacher",
  "/api/team",
  {
    action: "invite",
    email: "test@example.test",
    role: "teacher",
    subjectId: null,
  },
  403,
);
await save(
  "student",
  "note",
  "forged_note",
  { studentId: learner, text: "Cannot write notes" },
  403,
);
await save(
  "student",
  "student",
  other,
  { id: other, profile, savedCareers: [], createdAt: new Date().toISOString() },
  403,
);
await save("student", "progress", "progress_a", {
  studentId: learner,
  courseId: "digital",
  completed: [0],
  attempts: { 0: 1 },
  updatedAt: new Date().toISOString(),
});
await save("teacher", "assignment", "assignment_a", {
  studentId: learner,
  courseId: "communication",
});
const paid = {
  id: "paid_course",
  title: "Original paid course",
  subtitle: "Test",
  category: "Community",
  color: "mint",
  minutes: 10,
  skills: [],
  source: "https://www.diksha.gov.in/",
  sourceLabel: "Reference",
  price: 50,
  published: true,
  custom: true,
  lessons: [
    {
      title: "Lesson",
      text: "Private paid lesson content",
      question: "Question?",
      options: ["Yes", "No"],
      correct: 0,
      explanation: "Because",
    },
  ],
};
await save("teacher", "course", paid.id, paid);
const locked = (await call("student", "/api/state")).records.find(
  (r) => r.id === paid.id,
).data;
assert.equal(locked.locked, true);
assert.deepEqual(locked.lessons, []);
await save(
  "student",
  "progress",
  "forged_paid",
  { studentId: learner, courseId: paid.id, completed: [0], attempts: {} },
  403,
);
await call(
  "mentor",
  "/api/guide",
  {
    studentId: learner,
    message: "Tell me the learner's income",
    language: "en",
  },
  403,
);
const start = new Date(Date.now() + 86400000).toISOString();
const session = await call("student", "/api/mentoring", {
  action: "propose",
  studentId: learner,
  mentorId: mentor,
  startsAt: start,
  minutes: 30,
  goal: "Review my first design",
});
await call(
  "student",
  "/api/mentoring",
  {
    action: "propose",
    studentId: learner,
    mentorId: mentor,
    startsAt: start,
    minutes: 30,
    goal: "Overlap must fail",
  },
  409,
);
await call("stranger", `/api/mentoring?session=${session.id}`, undefined, 403);
await call(
  "student",
  "/api/mentoring",
  { action: "status", id: session.id, status: "confirmed" },
  403,
);
await call("mentor", "/api/mentoring", {
  action: "status",
  id: session.id,
  status: "confirmed",
});
await call("mentor", "/api/mentoring", {
  action: "message",
  id: session.id,
  text: "Please bring your original poster.",
});
assert.equal(
  (await call("student", `/api/mentoring?session=${session.id}`)).messages
    .length,
  1,
);
const mentorState = await call("mentor", "/api/state");
assert.equal(
  mentorState.records.some((r) => r.kind === "student"),
  false,
);
const job = {
  id: "partner_training",
  title: "QA training application",
  provider: "QA partner",
  type: "Training",
  description: "Test application intake",
  benefit: "QA only",
  location: "Test district",
  source: "https://www.skillindiadigital.gov.in/",
  sourceLabel: "Community partner link",
  verifiedAt: "2026-10-17",
  deadline: null,
  criteria: [],
  documents: [],
  sample: false,
  color: "mint",
  interests: [],
};
await save("employer", "opportunity", job.id, {
  ...job,
  partnerUserId: users.stranger.id,
});
const canonical = (await call("student", "/api/state")).records.find(
  (r) => r.id === job.id,
).data;
assert.equal(canonical.partnerUserId, users.employer.id);
assert.equal(canonical.intake, "disha");
await call(
  "student",
  "/api/submissions",
  {
    action: "submit",
    studentId: learner,
    opportunityId: job.id,
    consent: false,
    message: "Application",
  },
  400,
);
const application = await call("student", "/api/submissions", {
  action: "submit",
  studentId: learner,
  opportunityId: job.id,
  consent: true,
  message: "I want to learn this skill.",
});
await call(
  "student",
  "/api/submissions",
  {
    action: "submit",
    studentId: learner,
    opportunityId: job.id,
    consent: true,
    message: "Duplicate",
  },
  409,
);
await call(
  "student",
  "/api/submissions",
  {
    action: "review",
    id: application.id,
    status: "Accepted",
    response: "Forged decision",
  },
  403,
);
const partnerApps = await call("employer", "/api/submissions");
assert.equal(partnerApps.submissions.length, 1);
assert.equal("income" in partnerApps.submissions[0].snapshot, false);
await call("employer", "/api/submissions", {
  action: "review",
  id: application.id,
  status: "Under review",
  response: "We received your application.",
});
assert.equal(
  (await call("student", "/api/submissions")).submissions[0].status,
  "Under review",
);
await call(
  "student",
  "/api/opportunity-feed",
  { action: "import", items: [] },
  403,
);
await call(
  "owner",
  "/api/opportunity-feed",
  { action: "import", items: [{ ...job, source: "javascript:alert(1)" }] },
  400,
);
await call("owner", "/api/opportunity-feed", {
  action: "import",
  items: [job],
});
const imported = (await call("student", "/api/state")).records.find((r) =>
  r.id.startsWith("feed_"),
);
assert.equal(imported.data.intake, "external");
assert.ok(imported.data.refreshedAt);
await call(
  "student",
  "/api/billing",
  { action: "checkout", productId: `course_${paid.id}` },
  503,
);
const team = await call("owner", "/api/team");
for (const role of ["student", "teacher", "mentor", "employer"])
  await call(role, "/api/pilot", undefined, 403);
const pilot = await call("owner", "/api/pilot");
assert.equal(pilot.checks.length, 11);
assert.equal(pilot.passed, 0);
assert.equal(
  pilot.configuration.find((c) => c.id === "payments").configured,
  false,
);
await call(
  "student",
  "/api/pilot",
  {
    checkId: "android_offline",
    status: "passed",
    evidence: "A forged learner report",
  },
  403,
);
await call(
  "owner",
  "/api/pilot",
  {
    checkId: "unknown",
    status: "passed",
    evidence: "Unknown check should fail",
  },
  400,
);
await call(
  "owner",
  "/api/pilot",
  { checkId: "android_offline", status: "passed", evidence: "" },
  400,
);
await call("owner", "/api/pilot", {
  checkId: "android_offline",
  status: "blocked",
  evidence: "Disposable QA fixture: no physical Android device is connected.",
});
const recorded = await call("owner", "/api/pilot");
assert.equal(
  recorded.checks.find((c) => c.id === "android_offline").status,
  "blocked",
);
assert.equal(recorded.passed, 0);
await call("owner", "/api/pilot", {
  checkId: "android_offline",
  status: "not-run",
  evidence: "",
});
const member = team.members.find((m) => m.userId === users.student.id);
await call("owner", "/api/team", { action: "revoke-member", id: member.id });
await call("student", "/api/state", undefined, 403);
console.log(
  `${checks} HTTP assertions passed: separate accounts, roles, invitations, paid gates, mentoring, applications, feed validation, pilot evidence and revocation.`,
);
console.log(
  `Disposable QA centre ${ws}; all fixtures are local .test identities.`,
);
