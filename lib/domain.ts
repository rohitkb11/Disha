import jsonLogic from "json-logic-js";
import MiniSearch from "minisearch";
import { CAREERS, COURSES, OPPORTUNITIES } from "./catalog";
import type { Career, Opportunity, Profile } from "./types";

export function matchCareers(profile: Profile) {
  return CAREERS.map((career) => {
    const overlap = career.interests.filter((i) =>
      profile.interests.includes(i),
    );
    const score = Math.min(
      98,
      35 +
        overlap.length * 19 +
        (profile.education >= career.education ? 6 : 0),
    );
    const reasons = overlap.length
      ? overlap.map((i) => `Connects with your interest in ${i.toLowerCase()}`)
      : ["An additional direction to explore"];
    if (profile.education < career.education)
      reasons.push(
        `Plan a bridge from your current education to grade ${career.education} prerequisites`,
      );
    return { career, score, reasons, overlap: overlap.length };
  }).sort(
    (a, b) => b.score - a.score || a.career.title.localeCompare(b.career.title),
  );
}

export function checkEligibility(opportunity: Opportunity, profile: Profile) {
  if (!opportunity.sample || opportunity.criteria.length === 0)
    return {
      status: "verify" as const,
      label: "Check provider requirements",
      checks: [],
      missing: [],
    };
  const checks = opportunity.criteria.map((criterion) => {
    const value = profile[criterion.field as keyof Profile];
    const missing = value === null || value === undefined || value === "";
    return {
      ...criterion,
      result: missing
        ? "unknown"
        : jsonLogic.apply(criterion.rule as any, profile)
          ? "pass"
          : "fail",
    };
  });
  const status = checks.some((c) => c.result === "fail")
    ? "ineligible"
    : checks.some((c) => c.result === "unknown")
      ? "unknown"
      : "eligible";
  return {
    status,
    label:
      status === "eligible"
        ? "Meets sample criteria"
        : status === "unknown"
          ? "More information needed"
          : "Does not meet sample criteria",
    checks,
    missing: checks.filter((c) => c.result === "unknown").map((c) => c.label),
  };
}

export function coursePercent(completed: number[], lessonCount: number) {
  return lessonCount
    ? Math.round(
        (new Set(completed.filter((i) => i >= 0 && i < lessonCount)).size /
          lessonCount) *
          100,
      )
    : 0;
}

export function retrieve(query: string, profile?: Profile) {
  const documents = [
    ...CAREERS.map((c) => ({
      id: `career-${c.id}`,
      title: c.title,
      text: `${c.description} ${c.route} ${c.interests.join(" ")} ${c.skills.join(" ")}`,
      url: c.source,
    })),
    ...COURSES.map((c) => ({
      id: `course-${c.id}`,
      title: c.title,
      text: `${c.subtitle} ${c.skills.join(" ")} ${c.lessons.map((l) => l.text).join(" ")}`,
      url: c.source,
    })),
    ...OPPORTUNITIES.filter((o) => !o.sample).map((o) => ({
      id: `opportunity-${o.id}`,
      title: o.title,
      text: `${o.description} ${o.benefit} ${o.provider}`,
      url: o.source,
    })),
  ];
  const index = new MiniSearch({
    fields: ["title", "text"],
    storeFields: ["title", "text", "url"],
    searchOptions: { prefix: true, fuzzy: 0.2, boost: { title: 2 } },
  });
  index.addAll(documents);
  const found = index
    .search(query)
    .slice(0, 4)
    .map((x) => ({
      id: x.id,
      title: x.title as string,
      text: (x.text as string).slice(0, 1800),
      url: x.url as string,
    }));
  if (found.length) return found;
  const career = profile ? matchCareers(profile)[0].career : CAREERS[0];
  return [
    {
      id: `career-${career.id}`,
      title: career.title,
      text: `${career.description} ${career.route}`,
      url: career.source,
    },
    {
      id: "opportunity-ncs",
      title: "National Career Service",
      text: "Explore career information and local counselling. Check current provider requirements.",
      url: "https://www.ncs.gov.in/",
    },
  ];
}

export function careerTitle(career: Career, lang: string) {
  return lang === "hi" ? career.hi : lang === "mr" ? career.mr : career.title;
}
