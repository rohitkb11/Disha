export type Lang = "en" | "hi" | "mr";
export type Profile = {
  name: string;
  age: number | null;
  grade: string;
  district: string;
  state: string;
  language: Lang;
  interests: string[];
  goals: string;
  budget: number | null;
  hours: number;
  canTravel: boolean;
  education: number;
  income: number | null;
  completed: boolean;
};
export type Student = {
  id: string;
  profile: Profile;
  selectedCareer?: string;
  savedCareers: string[];
  createdAt: string;
  sample?: boolean;
};
export type Lesson = {
  title: string;
  text: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  hi?: {
    title: string;
    text: string;
    question: string;
    options: string[];
    explanation: string;
  };
  mr?: {
    title: string;
    text: string;
    question: string;
    options: string[];
    explanation: string;
  };
};
export type Course = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  color: string;
  minutes: number;
  skills: string[];
  lessons: Lesson[];
  source: string;
  sourceLabel: string;
  language?: Lang;
  price?: number;
  creator?: string;
  published?: boolean;
  custom?: boolean;
};
export type Career = {
  id: string;
  title: string;
  hi: string;
  mr: string;
  category: string;
  description: string;
  interests: string[];
  skills: string[];
  education: number;
  route: string;
  duration: string;
  courseIds: string[];
  source: string;
  sourceLabel: string;
  color: string;
  trial: {
    prompt: string;
    options: string[];
    correct: number;
    explanation: string;
  };
};
export type Criterion = {
  field: string;
  label: string;
  rule: Record<string, unknown>;
  description: string;
};
export type Opportunity = {
  id: string;
  title: string;
  provider: string;
  type:
    "Scholarship" | "Training" | "Apprenticeship" | "Mentorship" | "Experience";
  description: string;
  benefit: string;
  location: string;
  source: string;
  sourceLabel: string;
  verifiedAt: string;
  deadline: string | null;
  criteria: Criterion[];
  documents: string[];
  sample: boolean;
  color: string;
  interests: string[];
};
export type Progress = {
  studentId: string;
  courseId: string;
  completed: number[];
  attempts: Record<string, number>;
  updatedAt: string;
};
export type Application = {
  studentId: string;
  opportunityId: string;
  status: "Preparing" | "Ready to apply" | "Submitted externally" | "Accepted";
  documents: string[];
  notes: string;
  updatedAt: string;
};
export type Mentor = {
  id: string;
  name: string;
  title: string;
  organization: string;
  languages: string[];
  expertise: string[];
  bio: string;
  initials: string;
  color: string;
  sample: boolean;
};
export type RecordKind =
  | "student"
  | "progress"
  | "application"
  | "note"
  | "assignment"
  | "mentor-request"
  | "course"
  | "trial"
  | "mentor"
  | "opportunity";
export type AppRecord = {
  id: string;
  kind: RecordKind;
  data: any;
  updatedAt: string;
  revision?: number;
};
export type SyncEvent = {
  id: string;
  record: AppRecord;
  baseRevision: number;
  queuedAt: string;
};
export type AppState = {
  workspace: { id: string; name: string };
  user: { userId: string; name: string; email: string };
  records: AppRecord[];
  aiAvailable: boolean;
  offline?: boolean;
};
