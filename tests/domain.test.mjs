import test from "node:test";
import assert from "node:assert/strict";
import {
  matchCareers,
  checkEligibility,
  coursePercent,
  retrieve,
  CAREERS,
  COURSES,
  OPPORTUNITIES,
  validateRecord,
  sampleStudents,
  STRINGS,
} from "../.sites-runtime/test-domain.mjs";
const profile = sampleStudents()[0].profile;
test("regional language packs cover navigation and translated assessments retain answer alignment", () => {
  for (const lang of ["hi", "mr"]) {
    assert.deepEqual(
      Object.keys(STRINGS[lang]).sort(),
      Object.keys(STRINGS.en).sort(),
    );
    for (const course of COURSES)
      for (const lesson of course.lessons)
        if (lesson[lang])
          assert.equal(lesson[lang].options.length, lesson.options.length);
  }
});
test("career recommendations change when interests change", () => {
  const creative = matchCareers({
    ...profile,
    interests: ["Art & design", "Technology", "Communication"],
  });
  const caring = matchCareers({
    ...profile,
    interests: ["Helping people", "Teaching"],
  });
  assert.equal(creative[0].career.id, "designer");
  assert.ok(["teacher", "community"].includes(caring[0].career.id));
  assert.notEqual(creative[0].career.id, caring[0].career.id);
});
test("education gap does not erase aspirational careers", () => {
  const result = matchCareers({
    ...profile,
    education: 8,
    interests: ["Helping people"],
  });
  const healthcare = result.find((r) => r.career.id === "health");
  assert.ok(healthcare.reasons.some((r) => r.includes("bridge")));
});
test("missing income remains unknown instead of becoming zero", () => {
  const opportunity = OPPORTUNITIES.find((o) => o.id === "demo-fund");
  assert.equal(
    checkEligibility(opportunity, { ...profile, income: null }).status,
    "unknown",
  );
  assert.equal(
    checkEligibility(opportunity, { ...profile, income: 180000 }).status,
    "eligible",
  );
  assert.equal(
    checkEligibility(opportunity, { ...profile, income: 400000 }).status,
    "ineligible",
  );
});
test("official directory is never declared eligible using invented rules", () => {
  for (const o of OPPORTUNITIES.filter((o) => !o.sample))
    assert.equal(checkEligibility(o, profile).status, "verify");
});
test("progress ignores duplicates and out-of-range lesson ids", () => {
  assert.equal(coursePercent([0, 0, 1, -1, 100], 2), 100);
  assert.equal(coursePercent([], 0), 0);
  assert.equal(coursePercent([0], 2), 50);
});
test("retrieval returns identifiable source documents", () => {
  const results = retrieve("scholarship", profile);
  assert.ok(results.length > 0);
  assert.ok(results.every((r) => r.title && r.url.startsWith("https://")));
});
test("all career pathways reference existing learning content", () => {
  for (const c of CAREERS)
    for (const id of c.courseIds)
      assert.ok(
        COURSES.some((course) => course.id === id),
        `${c.id}: missing ${id}`,
      );
  for (const c of COURSES)
    for (const l of c.lessons)
      assert.ok(l.correct >= 0 && l.correct < l.options.length);
});
test("malformed records cannot enter the synchronization API", () => {
  assert.equal(validateRecord("student", { id: "fake", profile: {} }), false);
  assert.equal(
    validateRecord("progress", {
      studentId: "valid",
      courseId: "digital",
      completed: [-1],
      attempts: {},
    }),
    false,
  );
  assert.equal(
    validateRecord("application", {
      studentId: "valid",
      opportunityId: "nsp",
      status: "guaranteed",
      documents: [],
    }),
    false,
  );
  assert.equal(validateRecord("student", sampleStudents()[0]), true);
});
