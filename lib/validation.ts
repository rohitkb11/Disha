import { z } from "zod";
const id = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);
const profile = z.object({
  name: z.string().min(1).max(100),
  age: z.number().int().min(8).max(100).nullable(),
  grade: z.string().max(30),
  district: z.string().max(100),
  state: z.string().max(100),
  language: z.enum(["en", "hi", "mr"]),
  interests: z.array(z.string().max(80)).max(12),
  goals: z.string().max(2000),
  budget: z.number().min(0).max(10000000).nullable(),
  hours: z.number().min(0).max(100),
  canTravel: z.boolean(),
  education: z.number().int().min(0).max(20),
  income: z.number().min(0).max(100000000).nullable(),
  completed: z.boolean(),
});
export const studentSchema = z.object({
  id,
  profile,
  selectedCareer: z.string().max(100).optional(),
  savedCareers: z.array(z.string().max(100)).max(50),
  createdAt: z.string(),
  sample: z.boolean().optional(),
});
const generic = z
  .record(z.unknown())
  .refine((v) => JSON.stringify(v).length < 60000, "Record too large");
export const eventSchema = z.object({
  id,
  baseRevision: z.number().int().min(0),
  queuedAt: z.string(),
  record: z.object({
    id,
    kind: z.enum([
      "student",
      "progress",
      "application",
      "note",
      "assignment",
      "mentor-request",
      "course",
      "trial",
      "mentor",
      "opportunity",
    ]),
    data: generic,
    updatedAt: z.string(),
  }),
});
export function validateRecord(kind: string, data: any) {
  if (kind === "student") return studentSchema.safeParse(data).success;
  if (kind === "mentor")
    return (
      id.safeParse(data.id).success &&
      typeof data.name === "string" &&
      data.name.length > 0 &&
      data.name.length <= 100 &&
      typeof data.title === "string" &&
      typeof data.bio === "string" &&
      data.bio.length < 4000 &&
      Array.isArray(data.languages) &&
      data.languages.length <= 10 &&
      Array.isArray(data.expertise) &&
      data.expertise.length <= 20
    );
  if (kind === "opportunity")
    return (
      id.safeParse(data.id).success &&
      typeof data.title === "string" &&
      data.title.length > 0 &&
      data.title.length < 200 &&
      typeof data.provider === "string" &&
      typeof data.description === "string" &&
      data.description.length < 5000 &&
      typeof data.source === "string" &&
      /^https:\/\//.test(data.source) &&
      [
        "Scholarship",
        "Training",
        "Apprenticeship",
        "Mentorship",
        "Experience",
      ].includes(data.type) &&
      Array.isArray(data.documents) &&
      data.documents.length <= 30 &&
      data.documents.every((d: any) => typeof d === "string") &&
      Array.isArray(data.criteria) &&
      data.criteria.length === 0
    );
  if (kind === "course")
    return (
      typeof data.title === "string" &&
      data.title.length > 0 &&
      data.title.length < 200 &&
      Array.isArray(data.lessons) &&
      data.lessons.length <= 30 &&
      data.lessons.every(
        (l: any) =>
          typeof l.title === "string" &&
          typeof l.text === "string" &&
          typeof l.question === "string" &&
          Array.isArray(l.options) &&
          l.options.length >= 2 &&
          l.options.every((o: any) => typeof o === "string") &&
          Number.isInteger(l.correct) &&
          l.correct >= 0 &&
          l.correct < l.options.length,
      ) &&
      typeof data.price === "number" &&
      data.price >= 0 &&
      data.price <= 1000000
    );
  if (
    typeof data.studentId !== "string" ||
    !id.safeParse(data.studentId).success
  )
    return false;
  if (kind === "progress")
    return (
      typeof data.courseId === "string" &&
      Array.isArray(data.completed) &&
      data.completed.length <= 100 &&
      data.completed.every(
        (i: any) => Number.isInteger(i) && i >= 0 && i < 100,
      ) &&
      typeof data.attempts === "object"
    );
  if (kind === "application")
    return (
      typeof data.opportunityId === "string" &&
      [
        "Preparing",
        "Ready to apply",
        "Submitted externally",
        "Accepted",
      ].includes(data.status) &&
      Array.isArray(data.documents) &&
      data.documents.every((d: any) => typeof d === "string")
    );
  if (kind === "note")
    return (
      typeof data.text === "string" &&
      data.text.trim().length > 0 &&
      data.text.length < 4000
    );
  if (kind === "assignment") return typeof data.courseId === "string";
  if (kind === "mentor-request")
    return (
      typeof data.mentorId === "string" &&
      typeof data.goal === "string" &&
      data.goal.length > 0 &&
      data.goal.length < 2000
    );
  if (kind === "trial")
    return (
      typeof data.careerId === "string" &&
      Number.isInteger(data.answer) &&
      data.answer >= 0 &&
      data.answer < 20 &&
      typeof data.reflection === "string" &&
      data.reflection.length <= 4000
    );
  return false;
}
