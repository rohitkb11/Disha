import type { AppRecord } from "./types";

export type Role = "owner" | "teacher" | "student" | "mentor" | "employer";
export type Access = { role: Role; userId: string; subjectId: string | null };
export const isFacilitator = (a: Access) =>
  a.role === "owner" || a.role === "teacher";
export function canReadRecord(a: Access, r: AppRecord): boolean {
  if (isFacilitator(a)) return true;
  if (r.kind === "opportunity") return true;
  if (r.kind === "course")
    return a.role === "student" && r.data.published === true;
  if (r.kind === "mentor") return a.role === "student" || r.id === a.subjectId;
  if (a.role !== "student" || !a.subjectId) return false;
  if (r.kind === "student") return r.id === a.subjectId;
  if (r.kind === "note") return false;
  return r.data.studentId === a.subjectId;
}
export function canWriteRecord(
  a: Access,
  r: AppRecord,
  current?: AppRecord,
): boolean {
  if (current && current.kind !== r.kind) return false;
  if (current && !canWriteRecord(a, current)) return false;
  if (isFacilitator(a)) return true;
  if (a.role === "employer")
    return (
      r.kind === "opportunity" &&
      (!current || current.data.partnerUserId === a.userId)
    );
  if (a.role === "mentor") return r.kind === "mentor" && r.id === a.subjectId;
  if (a.role !== "student" || !a.subjectId) return false;
  if (r.kind === "student")
    return r.id === a.subjectId && r.data.id === a.subjectId;
  return (
    ["progress", "application", "trial", "mentor-request"].includes(r.kind) &&
    r.data.studentId === a.subjectId
  );
}
export function canAccessStudent(a: Access, id: string) {
  return isFacilitator(a) || (a.role === "student" && a.subjectId === id);
}
export function safeHttps(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
    );
  } catch {
    return false;
  }
}
