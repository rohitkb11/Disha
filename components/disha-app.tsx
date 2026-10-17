"use client";
import { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowLeft,
  Bookmark,
  BookOpen,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Compass,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  MessageCircle,
  Mic,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Sprout,
  Target,
  Users,
  Volume2,
  Wifi,
  WifiOff,
  X,
  RefreshCw,
  Award,
} from "lucide-react";
import { useDisha } from "./use-disha";
import { Modal, CourseIcon, Empty, ProgressBar, SourceLink } from "./shared";
import PartnerDialog from "./partner-dialog";
import ProfileInterview from "./profile-interview";
import {
  CAREERS,
  COURSES,
  INTERESTS,
  MENTORS,
  OPPORTUNITIES,
} from "@/lib/catalog";
import {
  careerTitle,
  checkEligibility,
  coursePercent,
  matchCareers,
  retrieve,
} from "@/lib/domain";
import { translator } from "@/lib/i18n";
import {
  clearOfflineData,
  offlineDb,
  prepareOfflineShell,
} from "@/lib/offline";
import type {
  Application,
  Career,
  Course,
  Lang,
  Mentor,
  Opportunity,
  Profile,
  Progress,
  Student,
} from "@/lib/types";

type DialogState =
  | { type: "profile"; new?: boolean }
  | { type: "career"; career: Career }
  | { type: "lesson"; course: Course }
  | { type: "trial"; career: Career }
  | { type: "application"; opportunity: Opportunity }
  | { type: "mentor"; mentor: Mentor }
  | { type: "module" }
  | { type: "partner" }
  | null;
const NAV = [
  { id: "home", key: "home", icon: LayoutDashboard },
  { id: "discover", key: "discover", icon: Compass },
  { id: "learn", key: "learn", icon: BookOpen },
  { id: "opportunities", key: "opportunities", icon: Briefcase },
  { id: "mentors", key: "mentors", icon: HeartHandshake },
  { id: "passport", key: "passport", icon: FileText },
] as const;

export default function DishaApp() {
  const app = useDisha();
  const t = translator(app.lang);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [centreTab, setCentreTab] = useState("Learners");
  const [offlineStatus, setOfflineStatus] = useState("");
  const [note, setNote] = useState("");
  const [assignCourse, setAssignCourse] = useState(COURSES[0].id);
  const students = (app.state?.records
    .filter((r) => r.kind === "student")
    .map((r) => r.data) || []) as Student[];
  const student = students.find((s) => s.id === app.studentId) || students[0];
  const profile = student?.profile;
  const customCourses = (app.state?.records
    .filter((r) => r.kind === "course")
    .map((r) => r.data) || []) as Course[];
  const courses = [...COURSES, ...customCourses];
  const records = app.state?.records || [];
  const opportunities: Opportunity[] = [
    ...OPPORTUNITIES,
    ...records.filter((r) => r.kind === "opportunity").map((r) => r.data),
  ];
  const mentors: Mentor[] = [
    ...MENTORS,
    ...records.filter((r) => r.kind === "mentor").map((r) => r.data),
  ];
  const progress = records
    .filter((r) => r.kind === "progress" && r.data.studentId === student?.id)
    .map((r) => r.data) as Progress[];
  const applications = records
    .filter((r) => r.kind === "application" && r.data.studentId === student?.id)
    .map((r) => r.data) as Application[];
  const matches = useMemo(
    () => (profile ? matchCareers(profile) : []),
    [profile],
  );
  const chosen = CAREERS.find((c) => c.id === student?.selectedCareer);
  const completedLessons = progress.reduce(
    (sum, p) => sum + p.completed.length,
    0,
  );
  const assignments = records.filter(
    (r) => r.kind === "assignment" && r.data.studentId === student?.id,
  );
  const displayedCourses = courses.filter(
    (c) =>
      !chosen ||
      chosen.courseIds.includes(c.id) ||
      assignments.some((a) => a.data.courseId === c.id),
  );
  useEffect(() => {
    setQuery("");
    setFilter("All");
    setMobileNav(false);
  }, [app.page]);
  function navigate(page: string) {
    app.navigate(page);
  }
  function saveStudent(updated: Student) {
    return app.save("student", updated.id, updated);
  }
  async function saveProfile(value: Profile, newStudent = false) {
    const valueToSave: Student = newStudent
      ? {
          id: crypto.randomUUID(),
          profile: value,
          savedCareers: [],
          createdAt: new Date().toISOString(),
          sample: false,
        }
      : { ...student, profile: value, sample: false };
    await saveStudent(valueToSave);
    app.setStudentId(valueToSave.id);
    setDialog(null);
    toast.success("Profile saved. Your recommendations have been updated.");
  }
  function progressFor(course: Course): Progress {
    return (
      progress.find((p) => p.courseId === course.id) || {
        studentId: student.id,
        courseId: course.id,
        completed: [],
        attempts: {},
        updatedAt: new Date().toISOString(),
      }
    );
  }
  async function saveProgress(p: Progress) {
    await app.save("progress", `progress_${student.id}_${p.courseId}`, p);
  }
  async function saveApplication(value: Application) {
    await app.save(
      "application",
      `application_${student.id}_${value.opportunityId}`,
      value,
    );
  }
  async function offlineReady() {
    if (!app.online) {
      toast.info(
        "Your saved catalogue and work are already available on this device.",
      );
      return;
    }
    setOfflineStatus("Preparing your offline copy…");
    try {
      await prepareOfflineShell();
      await app.sync(true);
      setOfflineStatus("Offline copy ready on this device.");
      toast.success("Learning catalogue and app shell saved for offline use.");
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Offline preparation could not finish. Please reconnect and retry.";
      setOfflineStatus(message);
      toast.error(message);
    }
  }
  function exportPassport() {
    const data = {
      student: student.profile,
      selectedCareer: chosen?.title,
      learning: progress.map((p) => ({
        course: courses.find((c) => c.id === p.courseId)?.title,
        completedLessons: p.completed.length,
      })),
      trials: records
        .filter((r) => r.kind === "trial" && r.data.studentId === student.id)
        .map((r) => r.data),
      applications,
      exportedAt: new Date().toISOString(),
      notice: "Personal learning record. Not an accredited qualification.",
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "disha-learning-passport.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast.success("Your learning passport was exported.");
  }
  const status = (
    <span className={`connection ${app.online ? "" : "offline"}`}>
      {app.online ? <Wifi size={14} /> : <WifiOff size={14} />}{" "}
      {app.online ? t("online") : t("offline")}
    </span>
  );
  const brand = (
    <div className="brand">
      <img src="/icon.svg" alt="" width="38" height="38" />
      <div>
        <strong>
          disha<span>.</span>
        </strong>
        <small>Find your way forward</small>
      </div>
    </div>
  );

  if (app.loading)
    return (
      <div className="boot">
        {brand}
        <div className="loader" />
        <p>Opening your learning space…</p>
      </div>
    );
  if (!app.state || !student)
    return (
      <>
        <Toaster richColors position="top-right" />
        <div className="welcome-page">
          <header>
            {brand}
            <select
              aria-label="Language"
              value={app.lang}
              onChange={(e) => app.changeLang(e.target.value as Lang)}
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="mr">मराठी</option>
            </select>
          </header>
          <main className="welcome-content">
            <div className="eyebrow">
              <Sprout size={17} /> LEARNING TO LIVELIHOOD
            </div>
            <h1>{t("welcome")}</h1>
            <p>{t("signInText")}</p>
            {app.error && app.error !== "AUTH_REQUIRED" ? (
              <div className="notice">
                {app.error}
                <button
                  className="button small"
                  onClick={() => void app.initialize()}
                >
                  Retry
                </button>
              </div>
            ) : (
              <a
                className="button"
                href="/signin-with-chatgpt?return_to=/"
                target="_top"
              >
                {t("signIn")}
                <ArrowRight size={18} />
              </a>
            )}
            <div className="welcome-features">
              <span>
                <Compass />
                Explore possibilities
              </span>
              <span>
                <BookOpen />
                Learn something useful
              </span>
              <span>
                <HeartHandshake />
                Get a little guidance
              </span>
            </div>
            <div className="welcome-bottom">
              <span>Built for small screens and big possibilities.</span>
              <span>English · हिन्दी · मराठी</span>
            </div>
          </main>
        </div>
      </>
    );

  return (
    <>
      <Toaster richColors position="top-right" />
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="app-shell">
        {mobileNav && (
          <button
            className="nav-scrim"
            aria-label="Close navigation"
            onClick={() => setMobileNav(false)}
          />
        )}
        <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
          {brand}
          <div className="sidebar-label">YOUR NEXT CHAPTER</div>
          <nav aria-label="Main navigation">
            {NAV.map((item) => (
              <button
                key={item.id}
                className={
                  app.page === item.id ? "nav-item active" : "nav-item"
                }
                onClick={() => navigate(item.id)}
              >
                <item.icon size={19} />
                <span>{t(item.key)}</span>
                {app.page === item.id && <span className="active-dot" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-secondary">
            <div className="sidebar-label">TOGETHER, WE GROW</div>
            <button
              className={`nav-item ${app.page === "facilitator" ? "active" : ""}`}
              onClick={() => navigate("facilitator")}
            >
              <Users size={19} />
              {t("facilitator")}
            </button>
            <button
              className={`nav-item ${app.page === "settings" ? "active" : ""}`}
              onClick={() => navigate("settings")}
            >
              <Settings size={19} />
              {t("settings")}
            </button>
          </div>
          <div className="sidebar-help">
            <div className="help-spark">
              <Sparkles size={19} />
            </div>
            <h4>A little help goes a long way.</h4>
            <p>Your questions are a good place to start.</p>
            <button onClick={() => setGuideOpen(true)}>
              {t("guide")}
              <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="sidebar-footer">
            <div className="avatar small">
              {student.profile.name.slice(0, 1)}
            </div>
            <div>
              <strong>{student.profile.name}</strong>
              <small>{student.profile.district || "Your learning space"}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Edit profile"
              onClick={() => setDialog({ type: "profile" })}
            >
              <Settings size={16} />
            </button>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="topbar-left">
              <button
                className="icon-button mobile-menu"
                aria-label="Open navigation"
                onClick={() => setMobileNav(true)}
              >
                <Menu size={22} />
              </button>
              <span className="breadcrumb">
                {app.page === "facilitator" ? t("teacher") : t("dashboard")}
                <ChevronRight size={14} />
                <strong>
                  {NAV.find((n) => n.id === app.page)
                    ? t(NAV.find((n) => n.id === app.page)!.key)
                    : app.page === "settings"
                      ? t("settings")
                      : t("facilitator")}
                </strong>
              </span>
            </div>
            <div className="topbar-right">
              {status}
              <select
                className="language-select"
                aria-label="Choose language"
                value={app.lang}
                onChange={(e) => app.changeLang(e.target.value as Lang)}
              >
                <option value="en">EN · English</option>
                <option value="hi">HI · हिन्दी</option>
                <option value="mr">MR · मराठी</option>
              </select>
              <button
                className="avatar"
                aria-label="Edit learner profile"
                onClick={() => setDialog({ type: "profile" })}
              >
                {student.profile.name.slice(0, 1)}
              </button>
            </div>
          </header>
          <main id="main-content" className="main-content" tabIndex={-1}>
            <div className="context-row">
              <span>
                <span className="tiny-leaf">
                  <Leaf size={13} />
                </span>{" "}
                YOUR FUTURE, ONE STEP AT A TIME
              </span>
              <button
                className="sync-status"
                onClick={() => void app.sync()}
                disabled={app.syncing || !app.online}
              >
                <RefreshCw
                  size={12}
                  className={app.syncing ? "spinning" : ""}
                />
                {app.pending ? `${app.pending} ${t("pending")}` : t("synced")}
              </button>
            </div>
            {app.page === "home" && (
              <>
                <section className="page-heading">
                  <div>
                    <h1>
                      {t("greeting")}, {student.profile.name}
                      <span className="greeting-leaf">✳</span>
                    </h1>
                    <p>
                      {t("today")} {t("subtitle")}
                    </p>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => setDialog({ type: "profile" })}
                  >
                    {t("profile")}
                    <ArrowUpRight size={16} />
                  </button>
                </section>
                <section className="journey-hero">
                  <div className="hero-copy">
                    <div className="hero-eyebrow">
                      <span /> A PATH THAT FEELS LIKE YOU
                    </div>
                    <h2>
                      {chosen ? (
                        <>
                          A little learning.
                          <br />A new possibility.
                        </>
                      ) : (
                        <>
                          Your next chapter
                          <br />
                          starts with curiosity.
                        </>
                      )}
                    </h2>
                    <p>
                      {chosen
                        ? `You're exploring ${chosen.title.toLowerCase()}. Let's turn that interest into something you can do.`
                        : "You don't need to have it all figured out. Discover a few possibilities, and take one small step."}
                    </p>
                    <button
                      className="button lime"
                      onClick={() => navigate(chosen ? "learn" : "discover")}
                    >
                      {chosen ? t("continue") : t("explore")}
                      <ArrowRight size={17} />
                    </button>
                  </div>
                  <div className="hero-journey" aria-hidden="true">
                    <div className="orbit orbit-one" />
                    <div className="orbit orbit-two" />
                    <div className="journey-symbol">
                      <Sprout size={58} strokeWidth={1.2} />
                    </div>
                    <div className="journey-tag tag-one">
                      <span>
                        <Compass size={17} />
                      </span>
                      Find your direction
                    </div>
                    <div className="journey-tag tag-two">
                      <span>
                        <BookOpen size={17} />
                      </span>
                      Grow a little, every day
                    </div>
                    <div className="journey-dots">
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                </section>
                <div className="stats-row">
                  <Stat
                    icon={Compass}
                    label="Career directions"
                    value={String(CAREERS.length)}
                    detail="Possibilities to explore"
                  />
                  <Stat
                    icon={BookOpen}
                    label="Learning steps"
                    value={String(completedLessons)}
                    detail="Lessons you've completed"
                  />
                  <Stat
                    icon={Bookmark}
                    label="Saved careers"
                    value={String(student.savedCareers.length)}
                    detail="Your growing shortlist"
                  />
                  <Stat
                    icon={Target}
                    label="Applications"
                    value={String(applications.length)}
                    detail="Next steps in progress"
                  />
                </div>
                <div className="dashboard-columns">
                  <div>
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">
                          SMALL STEPS, REAL PROGRESS
                        </span>
                        <h2>{t("continue")}</h2>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => navigate("learn")}
                      >
                        {t("viewAll")}
                        <ArrowRight size={15} />
                      </button>
                    </div>
                    <div className="course-list">
                      {displayedCourses.slice(0, 2).map((course) => (
                        <CourseRow
                          key={course.id}
                          course={course}
                          percent={coursePercent(
                            progressFor(course).completed,
                            course.lessons.length,
                          )}
                          onClick={() => setDialog({ type: "lesson", course })}
                          t={t}
                        />
                      ))}
                    </div>
                    <div className="section-heading space-top">
                      <div>
                        <span className="eyebrow">FOLLOW YOUR CURIOSITY</span>
                        <h2>{t("recommended")}</h2>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => navigate("discover")}
                      >
                        {t("viewAll")}
                        <ArrowRight size={15} />
                      </button>
                    </div>
                    <div className="career-mini-grid">
                      {matches.slice(0, 2).map(({ career, reasons }) => (
                        <button
                          key={career.id}
                          className="career-mini"
                          onClick={() => setDialog({ type: "career", career })}
                        >
                          <div className={`course-art mini ${career.color}`}>
                            <CourseIcon id={career.courseIds[0]} />
                          </div>
                          <span className="eyebrow">{career.category}</span>
                          <h3>{careerTitle(career, app.lang)}</h3>
                          <p>{reasons[0]}</p>
                          <span className="card-link">
                            Take a closer look
                            <ArrowUpRight size={16} />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <aside className="next-panel">
                    <div className="section-heading">
                      <h2>{t("latest")}</h2>
                      <span className="step-count">03</span>
                    </div>
                    <ActionStep
                      number="01"
                      title={
                        profile!.completed
                          ? "Explore another possibility"
                          : "Tell us a little about you"
                      }
                      detail={
                        profile!.completed
                          ? "Your interests can grow and change."
                          : "A few interests help us find your starting point."
                      }
                      onClick={() =>
                        profile!.completed
                          ? navigate("discover")
                          : setDialog({ type: "profile" })
                      }
                    />
                    <ActionStep
                      number="02"
                      title="Try something, learn something"
                      detail="A short activity can open a new direction."
                      onClick={() =>
                        setDialog({
                          type: "trial",
                          career: chosen || matches[0].career,
                        })
                      }
                    />
                    <ActionStep
                      number="03"
                      title="Find support for your journey"
                      detail="Explore scholarships, training and guidance."
                      onClick={() => navigate("opportunities")}
                    />
                    <div className="mentor-nudge">
                      <HeartHandshake size={27} />
                      <h3>You don't have to do this alone.</h3>
                      <p>
                        A good question is all it takes to start a conversation.
                      </p>
                      <button
                        className="text-button"
                        onClick={() => navigate("mentors")}
                      >
                        {t("mentors")}
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </aside>
                </div>
              </>
            )}
            {app.page === "discover" && (
              <>
                <PageHeading
                  eyebrow="A WORLD OF POSSIBILITIES"
                  title={t("discover")}
                  subtitle="Your interests are a starting point. Explore familiar paths and unexpected ones."
                />
                <div className="toolbar">
                  <SearchInput
                    value={query}
                    onChange={setQuery}
                    placeholder="Search careers, interests or skills…"
                  />
                  <div className="filter-tabs">
                    {[
                      "All",
                      "Creative",
                      "Technology",
                      "Green skills",
                      "Saved",
                    ].map((v) => (
                      <button
                        key={v}
                        className={filter === v ? "selected" : ""}
                        onClick={() => setFilter(v)}
                      >
                        {v === "All"
                          ? t("all")
                          : v === "Saved"
                            ? t("saved")
                            : v}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="subtle">
                  Recommendations reflect your selected interests. They are
                  exploration suggestions, not validated aptitude scores.
                </p>
                <div className="card-grid">
                  {matches
                    .filter(({ career }) =>
                      filter === "All" || filter === "Saved"
                        ? filter !== "Saved" ||
                          student.savedCareers.includes(career.id)
                        : career.category === filter,
                    )
                    .filter(({ career }) =>
                      `${career.title} ${career.hi} ${career.mr} ${career.description} ${career.interests.join(" ")}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map(({ career, overlap }) => (
                      <article className="career-card" key={career.id}>
                        <div className={`career-banner ${career.color}`}>
                          <CourseIcon id={career.courseIds[0]} size={38} />
                          <button
                            className={`bookmark ${student.savedCareers.includes(career.id) ? "bookmarked" : ""}`}
                            aria-label={`${student.savedCareers.includes(career.id) ? "Unsave" : "Save"} ${career.title}`}
                            onClick={() =>
                              void saveStudent({
                                ...student,
                                savedCareers: student.savedCareers.includes(
                                  career.id,
                                )
                                  ? student.savedCareers.filter(
                                      (id) => id !== career.id,
                                    )
                                  : [...student.savedCareers, career.id],
                              })
                            }
                          >
                            <Bookmark
                              size={19}
                              fill={
                                student.savedCareers.includes(career.id)
                                  ? "currentColor"
                                  : "none"
                              }
                            />
                          </button>
                          <span>{career.category}</span>
                        </div>
                        <div className="card-body">
                          <span className="match-tag">
                            <Sparkles size={12} />
                            {overlap
                              ? `${overlap} shared interests`
                              : "A new direction"}
                          </span>
                          <h3>{careerTitle(career, app.lang)}</h3>
                          <p>{career.description}</p>
                          <button
                            className="text-button"
                            onClick={() =>
                              setDialog({ type: "career", career })
                            }
                          >
                            Explore this path
                            <ArrowUpRight size={16} />
                          </button>
                        </div>
                      </article>
                    ))}
                </div>
                {!matches.filter((m) =>
                  `${m.career.title} ${m.career.hi} ${m.career.mr} ${m.career.description}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                ).length && <Empty title={t("noResults")} />}
              </>
            )}
            {app.page === "learn" && (
              <>
                <PageHeading
                  eyebrow="MAKE A LITTLE PROGRESS"
                  title={t("learn")}
                  subtitle="Short lessons. Useful practice. A pace that works for you."
                  action={
                    <button
                      className="button secondary"
                      onClick={() => void offlineReady()}
                    >
                      <Download size={17} />
                      {t("download")}
                    </button>
                  }
                />
                {chosen && (
                  <div className="pathway-strip">
                    <div className="pathway-icon">
                      <Compass size={25} />
                    </div>
                    <div>
                      <small>YOUR CHOSEN DIRECTION</small>
                      <h3>{careerTitle(chosen, app.lang)}</h3>
                      <p>{chosen.route}</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() =>
                        setDialog({ type: "career", career: chosen })
                      }
                    >
                      View pathway
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                )}
                <div className="toolbar">
                  <SearchInput
                    value={query}
                    onChange={setQuery}
                    placeholder="Search courses or skills…"
                  />
                  <div className="filter-tabs">
                    {["All", "My pathway", "Completed"].map((v) => (
                      <button
                        key={v}
                        onClick={() => setFilter(v)}
                        className={filter === v ? "selected" : ""}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card-grid">
                  {courses
                    .filter((c) =>
                      `${c.title} ${c.category} ${c.skills.join(" ")}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .filter(
                      (c) =>
                        filter === "All" ||
                        (filter === "My pathway" &&
                          (chosen?.courseIds.includes(c.id) ||
                            assignments.some(
                              (a) => a.data.courseId === c.id,
                            ))) ||
                        (filter === "Completed" &&
                          progressFor(c).completed.length === c.lessons.length),
                    )
                    .map((course) => {
                      const percent = coursePercent(
                        progressFor(course).completed,
                        course.lessons.length,
                      );
                      return (
                        <article key={course.id} className="learning-card">
                          <button
                            className={`course-cover ${course.color}`}
                            onClick={() =>
                              setDialog({ type: "lesson", course })
                            }
                            aria-label={`Open ${course.title}`}
                          >
                            <CourseIcon id={course.id} size={44} />
                            <span className="course-cover-tag">
                              {course.category}
                            </span>
                          </button>
                          <div className="card-body">
                            <div className="course-meta">
                              <span>
                                <Clock3 size={13} />
                                {course.minutes} {t("minutes")}
                              </span>
                              <span>{course.lessons.length} lessons</span>
                            </div>
                            <h3>{course.title}</h3>
                            <p>{course.subtitle}</p>
                            {course.custom && (
                              <span className="tag">
                                {course.price
                                  ? `₹${course.price} · Payment not connected`
                                  : "Facilitator-created · Free"}
                              </span>
                            )}
                            <div className="course-progress-label">
                              <span>
                                {percent
                                  ? `${percent}% ${t("completed")}`
                                  : "A fresh start"}
                              </span>
                              <span>
                                {progressFor(course).completed.length}/
                                {course.lessons.length}
                              </span>
                            </div>
                            <ProgressBar value={percent} />
                            <button
                              className="button course-button"
                              onClick={() =>
                                setDialog({ type: "lesson", course })
                              }
                            >
                              {percent === 100
                                ? "Review course"
                                : percent
                                  ? t("continue")
                                  : t("start")}
                              <ArrowRight size={16} />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                </div>
              </>
            )}
            {app.page === "opportunities" && (
              <>
                <PageHeading
                  eyebrow="OPEN A NEW DOOR"
                  title={t("opportunities")}
                  subtitle="Find support, learning and experience for the direction you choose."
                />
                <div className="notice neutral">
                  <ShieldCheck size={20} />
                  <span>
                    Official program directories link to their providers.
                    Demonstration listings are labelled. Always confirm current
                    eligibility and dates with the provider.
                  </span>
                </div>
                <div className="toolbar">
                  <SearchInput
                    value={query}
                    onChange={setQuery}
                    placeholder="Search opportunities or providers…"
                  />
                  <div className="filter-tabs">
                    {[
                      "All",
                      "Scholarship",
                      "Training",
                      "Apprenticeship",
                      "My applications",
                    ].map((v) => (
                      <button
                        key={v}
                        className={filter === v ? "selected" : ""}
                        onClick={() => setFilter(v)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="opportunity-list">
                  {opportunities
                    .filter(
                      (o) =>
                        (filter === "All" || filter === "My applications"
                          ? filter !== "My applications" ||
                            applications.some((a) => a.opportunityId === o.id)
                          : o.type === filter) &&
                        `${o.title} ${o.provider} ${o.description}`
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                    )
                    .map((o) => {
                      const eligible = checkEligibility(o, student.profile);
                      const application = applications.find(
                        (a) => a.opportunityId === o.id,
                      );
                      return (
                        <article className="opportunity-card" key={o.id}>
                          <div className={`opportunity-icon ${o.color}`}>
                            {o.type === "Scholarship" ? (
                              <GraduationCap size={27} />
                            ) : o.type === "Mentorship" ? (
                              <HeartHandshake size={27} />
                            ) : (
                              <Briefcase size={27} />
                            )}
                          </div>
                          <div className="opportunity-main">
                            <div className="tag-row">
                              <span className="eyebrow">{o.type}</span>
                              {o.sample && (
                                <span className="tag warning">{t("demo")}</span>
                              )}
                              {application && (
                                <span className="tag green">
                                  {application.status}
                                </span>
                              )}
                            </div>
                            <h3>{o.title}</h3>
                            <p>
                              {o.provider} <span className="separator">·</span>{" "}
                              {o.location}
                            </p>
                            <p className="opportunity-description">
                              {o.description}
                            </p>
                            <div className="opportunity-footer">
                              <span>
                                <CheckCircle2 size={14} />
                                {eligible.label}
                              </span>
                              <span>{o.benefit}</span>
                            </div>
                          </div>
                          <button
                            className="button secondary"
                            onClick={() =>
                              setDialog({ type: "application", opportunity: o })
                            }
                          >
                            {application
                              ? "View checklist"
                              : "View opportunity"}
                            <ArrowUpRight size={16} />
                          </button>
                        </article>
                      );
                    })}
                </div>
              </>
            )}
            {app.page === "mentors" && (
              <>
                <PageHeading
                  eyebrow="A CONVERSATION CAN CHANGE THINGS"
                  title={t("mentors")}
                  subtitle="Prepare a question, share what you're working on, and ask for guidance."
                />
                <div className="notice neutral">
                  <HeartHandshake size={20} />
                  <span>
                    Sample mentors are labelled; your facilitator can also add
                    community mentors. Requests are saved for your facilitator;
                    no external message is sent. Use National Career Service to
                    explore real counselling options.
                  </span>
                </div>
                <div className="card-grid">
                  {mentors.map((mentor) => (
                    <article className="mentor-card" key={mentor.id}>
                      <div className={`mentor-avatar ${mentor.color}`}>
                        {mentor.initials}
                      </div>
                      <span className="tag">
                        {mentor.sample
                          ? "Sample mentor"
                          : "Facilitator-added mentor"}
                      </span>
                      <h3>{mentor.name}</h3>
                      <h4>{mentor.title}</h4>
                      <p>{mentor.bio}</p>
                      <div className="tag-row">
                        {mentor.languages.map((l) => (
                          <span className="tag" key={l}>
                            {l}
                          </span>
                        ))}
                      </div>
                      <button
                        className="button secondary"
                        onClick={() => setDialog({ type: "mentor", mentor })}
                      >
                        Prepare a request
                        <ArrowUpRight size={16} />
                      </button>
                    </article>
                  ))}
                </div>
                <div className="panel space-top">
                  <h3>Explore real career guidance</h3>
                  <p>
                    Find counselling and career centres through the official
                    National Career Service.
                  </p>
                  <SourceLink url="https://www.ncs.gov.in/">
                    Visit National Career Service
                  </SourceLink>
                </div>
              </>
            )}
            {app.page === "passport" && (
              <>
                <PageHeading
                  eyebrow="LOOK HOW FAR YOU'VE COME"
                  title={t("passport")}
                  subtitle="Your interests, your work and the small steps that add up."
                  action={
                    <button
                      className="button secondary"
                      onClick={exportPassport}
                    >
                      <Download size={16} />
                      {t("export")}
                    </button>
                  }
                />
                <div className="passport-panel">
                  <div className="passport-top">
                    <div className="avatar large">{profile!.name[0]}</div>
                    <div>
                      <span className="eyebrow">DISHA LEARNING PASSPORT</span>
                      <h2>{profile!.name}</h2>
                      <p>
                        {profile!.district} · Grade {profile!.grade}{" "}
                        {student.sample && "· Sample learner"}
                      </p>
                    </div>
                    <img src="/icon.svg" width="46" height="46" alt="Disha" />
                  </div>
                  <div className="passport-section">
                    <h3>{t("interests")}</h3>
                    <div className="tag-row">
                      {profile!.interests.map((i) => (
                        <span className="tag green" key={i}>
                          {i}
                        </span>
                      ))}
                    </div>
                    <p>{profile!.goals}</p>
                  </div>
                  <div className="passport-section">
                    <h3>My direction</h3>
                    <p>
                      {chosen
                        ? careerTitle(chosen, app.lang)
                        : "Still exploring. Every question is a starting point."}
                    </p>
                  </div>
                  <div className="passport-section">
                    <h3>{t("achievements")}</h3>
                    {progress.length ? (
                      progress.map((p) => (
                        <div className="evidence-row" key={p.courseId}>
                          <div className="evidence-icon">
                            <BookOpen size={20} />
                          </div>
                          <div>
                            <strong>
                              {courses.find((c) => c.id === p.courseId)
                                ?.title || p.courseId}
                            </strong>
                            <small>
                              {p.completed.length} lessons completed ·
                              Self-paced practice
                            </small>
                          </div>
                          <CheckCircle2 size={20} />
                        </div>
                      ))
                    ) : (
                      <p className="subtle">
                        Complete your first lesson to add learning evidence
                        here.
                      </p>
                    )}
                    {records
                      .filter(
                        (r) =>
                          r.kind === "trial" && r.data.studentId === student.id,
                      )
                      .map((r) => (
                        <div className="evidence-row" key={r.id}>
                          <div className="evidence-icon">
                            <Compass size={20} />
                          </div>
                          <div>
                            <strong>
                              {
                                CAREERS.find((c) => c.id === r.data.careerId)
                                  ?.title
                              }{" "}
                              · Career activity
                            </strong>
                            <small>
                              {r.data.reflection ||
                                "Exploration activity completed"}
                            </small>
                          </div>
                        </div>
                      ))}
                  </div>
                  <div className="passport-section">
                    <h3>{t("applications")}</h3>
                    {applications.length ? (
                      applications.map((a) => (
                        <div className="simple-row" key={a.opportunityId}>
                          <span>
                            {
                              opportunities.find(
                                (o) => o.id === a.opportunityId,
                              )?.title
                            }
                          </span>
                          <span className="tag">{a.status}</span>
                        </div>
                      ))
                    ) : (
                      <p className="subtle">
                        Your application checklists will appear here.
                      </p>
                    )}
                  </div>
                  <footer className="passport-disclaimer">
                    <ShieldCheck size={17} />A personal learning record, not an
                    accredited qualification or employment guarantee.
                  </footer>
                </div>
                <button
                  className="text-button space-top"
                  onClick={() => window.print()}
                >
                  {t("print")}
                  <ExternalLink size={15} />
                </button>
              </>
            )}
            {app.page === "facilitator" && (
              <>
                <PageHeading
                  eyebrow="HELP POTENTIAL FIND ITS WAY"
                  title={t("workspace")}
                  subtitle="One place to support each learner's next step."
                  action={
                    <button
                      className="button"
                      onClick={() => setDialog({ type: "profile", new: true })}
                    >
                      <Plus size={17} />
                      {t("addStudent")}
                    </button>
                  }
                />
                <div className="stats-row">
                  <Stat
                    icon={Users}
                    label="Learners"
                    value={String(students.length)}
                    detail="In your private workspace"
                  />
                  <Stat
                    icon={Target}
                    label="Need a profile review"
                    value={String(
                      students.filter((s) => !s.profile.completed).length,
                    )}
                    detail="An opportunity to help"
                  />
                  <Stat
                    icon={FileText}
                    label="Application checklists"
                    value={String(
                      records.filter((r) => r.kind === "application").length,
                    )}
                    detail="Across your learners"
                  />
                  <Stat
                    icon={BookOpen}
                    label="Your modules"
                    value={String(customCourses.length)}
                    detail="Original local content"
                  />
                </div>
                <div className="filter-tabs centre-tabs">
                  {[
                    "Learners",
                    "Applications",
                    "Mentor requests",
                    "Training modules",
                    "Partners",
                  ].map((v) => (
                    <button
                      key={v}
                      className={centreTab === v ? "selected" : ""}
                      onClick={() => setCentreTab(v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                {centreTab === "Learners" && (
                  <>
                    <div className="panel learner-table-wrap">
                      <table className="learner-table">
                        <thead>
                          <tr>
                            <th>Learner</th>
                            <th>Direction</th>
                            <th>Next support</th>
                            <th>Lessons</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((s) => (
                            <tr
                              key={s.id}
                              className={
                                student.id === s.id ? "selected-row" : ""
                              }
                            >
                              <td>
                                <div className="person-cell">
                                  <span className="avatar small">
                                    {s.profile.name[0]}
                                  </span>
                                  <div>
                                    <strong>{s.profile.name}</strong>
                                    <small>
                                      {s.profile.district} · Grade{" "}
                                      {s.profile.grade}
                                    </small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                {CAREERS.find((c) => c.id === s.selectedCareer)
                                  ?.title || "Exploring"}
                              </td>
                              <td>
                                <span
                                  className={`tag ${s.profile.completed ? "green" : "warning"}`}
                                >
                                  {s.profile.completed
                                    ? "Check next action"
                                    : "Review profile"}
                                </span>
                              </td>
                              <td>
                                {records
                                  .filter(
                                    (r) =>
                                      r.kind === "progress" &&
                                      r.data.studentId === s.id,
                                  )
                                  .reduce(
                                    (sum, r) => sum + r.data.completed.length,
                                    0,
                                  )}
                              </td>
                              <td>
                                <button
                                  className="text-button"
                                  onClick={() => {
                                    app.setStudentId(s.id);
                                    toast.info(`Supporting ${s.profile.name}`);
                                  }}
                                >
                                  Support
                                  <ArrowRight size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="two-columns space-top">
                      <div className="panel">
                        <span className="eyebrow">
                          SUPPORTING {student.profile.name.toUpperCase()}
                        </span>
                        <h3>{t("notes")}</h3>
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (!note.trim()) return;
                            await app.save("note", crypto.randomUUID(), {
                              studentId: student.id,
                              text: note.trim(),
                              createdAt: new Date().toISOString(),
                            });
                            setNote("");
                            toast.success("Facilitator note saved.");
                          }}
                        >
                          <label className="sr-only" htmlFor="teacher-note">
                            Facilitator note
                          </label>
                          <textarea
                            id="teacher-note"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="What is the learner's next step?"
                            maxLength={3000}
                            required
                          />
                          <button className="button small" type="submit">
                            <Plus size={15} />
                            {t("addNote")}
                          </button>
                        </form>
                        {records
                          .filter(
                            (r) =>
                              r.kind === "note" &&
                              r.data.studentId === student.id,
                          )
                          .map((r) => (
                            <div className="note-item" key={r.id}>
                              <p>{r.data.text}</p>
                              <small>
                                {new Date(
                                  r.data.createdAt,
                                ).toLocaleDateString()}
                              </small>
                            </div>
                          ))}
                      </div>
                      <div className="panel">
                        <span className="eyebrow">AN ACHIEVABLE NEXT STEP</span>
                        <h3>Assign learning</h3>
                        <p>
                          Give {student.profile.name} a useful place to start.
                        </p>
                        <label htmlFor="assign-course">Learning module</label>
                        <select
                          id="assign-course"
                          value={assignCourse}
                          onChange={(e) => setAssignCourse(e.target.value)}
                        >
                          {courses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                            </option>
                          ))}
                        </select>
                        <button
                          className="button small space-top"
                          onClick={async () => {
                            await app.save(
                              "assignment",
                              `assignment_${student.id}_${assignCourse}`,
                              {
                                studentId: student.id,
                                courseId: assignCourse,
                                createdAt: new Date().toISOString(),
                              },
                            );
                            toast.success("Learning assigned to this learner.");
                          }}
                        >
                          Assign module
                          <ArrowRight size={15} />
                        </button>
                        <div className="space-top">
                          {assignments.map((a) => (
                            <div className="simple-row" key={a.id}>
                              <BookOpen size={16} />
                              {
                                courses.find((c) => c.id === a.data.courseId)
                                  ?.title
                              }
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
                {centreTab === "Applications" && (
                  <div className="panel">
                    {records.filter((r) => r.kind === "application").length ? (
                      records
                        .filter((r) => r.kind === "application")
                        .map((r) => (
                          <div className="simple-row" key={r.id}>
                            <div>
                              <strong>
                                {
                                  students.find(
                                    (s) => s.id === r.data.studentId,
                                  )?.profile.name
                                }
                              </strong>
                              <p>
                                {
                                  opportunities.find(
                                    (o) => o.id === r.data.opportunityId,
                                  )?.title
                                }
                              </p>
                            </div>
                            <span className="tag green">{r.data.status}</span>
                          </div>
                        ))
                    ) : (
                      <Empty
                        title="No application checklists yet"
                        detail="Help a learner prepare their first opportunity checklist."
                      />
                    )}
                  </div>
                )}
                {centreTab === "Mentor requests" && (
                  <div className="panel">
                    {records.filter((r) => r.kind === "mentor-request")
                      .length ? (
                      records
                        .filter((r) => r.kind === "mentor-request")
                        .map((r) => (
                          <div className="request-row" key={r.id}>
                            <div>
                              <strong>
                                {
                                  students.find(
                                    (s) => s.id === r.data.studentId,
                                  )?.profile.name
                                }{" "}
                                →{" "}
                                {
                                  mentors.find((m) => m.id === r.data.mentorId)
                                    ?.name
                                }
                              </strong>
                              <p>{r.data.goal}</p>
                              <small>
                                Demonstration request · saved locally, not sent
                                externally
                              </small>
                            </div>
                            <select
                              aria-label="Mentor request status"
                              value={r.data.status}
                              onChange={(e) =>
                                void app.save("mentor-request", r.id, {
                                  ...r.data,
                                  status: e.target.value,
                                })
                              }
                            >
                              <option>Awaiting facilitator</option>
                              <option>Reviewed</option>
                              <option>Practice session planned</option>
                            </select>
                          </div>
                        ))
                    ) : (
                      <Empty
                        title="No mentor requests yet"
                        detail="Learners can prepare a question from the mentor page."
                      />
                    )}
                  </div>
                )}
                {centreTab === "Training modules" && (
                  <>
                    <div className="section-heading">
                      <p>
                        Build original modules for your community. Pricing is
                        recorded; payment collection is not connected.
                      </p>
                      <button
                        className="button"
                        onClick={() => setDialog({ type: "module" })}
                      >
                        <Plus size={16} />
                        {t("createModule")}
                      </button>
                    </div>
                    {customCourses.length ? (
                      customCourses.map((c) => (
                        <CourseRow
                          key={c.id}
                          course={c}
                          percent={0}
                          onClick={() =>
                            setDialog({ type: "lesson", course: c })
                          }
                          t={t}
                        />
                      ))
                    ) : (
                      <Empty
                        title="Your first module starts here"
                        detail="Add a short lesson, a practical question and a clear next step."
                      />
                    )}
                  </>
                )}
              </>
            )}
            {app.page === "facilitator" && centreTab === "Partners" && (
              <div className="panel">
                <h3>Grow your local support network</h3>
                <p>
                  Add a community mentor or an opportunity from a training
                  provider, NGO or employer. Partner-provided details are
                  labelled and must be verified before a learner acts.
                </p>
                <button
                  className="button"
                  onClick={() => setDialog({ type: "partner" })}
                >
                  <Plus size={16} />
                  Add a mentor or opportunity
                </button>
                <div className="space-top">
                  {records
                    .filter(
                      (r) => r.kind === "mentor" || r.kind === "opportunity",
                    )
                    .map((r) => (
                      <div className="simple-row" key={r.id}>
                        <strong>{r.data.name || r.data.title}</strong>
                        <span className="tag">
                          {r.kind} · Facilitator-added
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
            {app.page === "settings" && (
              <SettingsPage
                app={app}
                t={t}
                onPrepare={offlineReady}
                offlineStatus={offlineStatus}
              />
            )}
            {student.sample && (
              <div className="sample-notice">
                <span className="sample-dot" />
                <strong>{t("sample")}</strong>
                <span>{t("sampleNote")}</span>
                <button
                  onClick={() => setDialog({ type: "profile", new: true })}
                >
                  Create my profile
                  <ArrowUpRight size={14} />
                </button>
              </div>
            )}
            <footer className="app-footer">
              <span>
                disha. <span className="separator">·</span> Every next step
                matters.
              </span>
              <span>
                Built with open-source foundations <Sprout size={13} />
              </span>
            </footer>
          </main>
        </div>
      </div>
      <button className="guide-fab" onClick={() => setGuideOpen(true)}>
        <Sparkles size={19} />
        <span>{t("guide")}</span>
      </button>
      {dialog?.type === "profile" && (
        <ProfileDialog
          key={dialog.new ? "new" : student.id}
          profile={
            dialog.new
              ? {
                  name: "",
                  age: null,
                  grade: "10",
                  education: 10,
                  district: "",
                  state: "Maharashtra",
                  language: app.lang,
                  interests: [],
                  goals: "",
                  budget: null,
                  income: null,
                  hours: 3,
                  canTravel: false,
                  completed: false,
                }
              : student.profile
          }
          lang={app.lang}
          onClose={() => setDialog(null)}
          onSave={(p) => saveProfile(p, dialog.new)}
        />
      )}
      {dialog?.type === "career" && (
        <Modal
          title={careerTitle(dialog.career, app.lang)}
          onClose={() => setDialog(null)}
        >
          <div className={`detail-art ${dialog.career.color}`}>
            <CourseIcon id={dialog.career.courseIds[0]} size={42} />
            <span>{dialog.career.category}</span>
          </div>
          <p className="lead">{dialog.career.description}</p>
          <h3>Why explore this?</h3>
          <ul className="check-list">
            {matches
              .find((m) => m.career.id === dialog.career.id)
              ?.reasons.map((r) => (
                <li key={r}>
                  <Check size={15} />
                  {r}
                </li>
              ))}
          </ul>
          <h3>A route to explore</h3>
          <p>{dialog.career.route}</p>
          <div className="notice neutral">
            <Compass size={19} />
            <span>
              Provider requirements vary. This is a starting route, not
              admission or job eligibility advice.
            </span>
          </div>
          <h3>Your first learning steps</h3>
          {dialog.career.courseIds.map((id, i) => (
            <div className="pathway-step" key={id}>
              <span>{i + 1}</span>
              <div>
                <strong>{courses.find((c) => c.id === id)?.title}</strong>
                <small>{courses.find((c) => c.id === id)?.subtitle}</small>
              </div>
            </div>
          ))}
          <SourceLink url={dialog.career.source}>
            {dialog.career.sourceLabel}
          </SourceLink>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() =>
                setDialog({ type: "trial", career: dialog.career })
              }
            >
              {t("trial")}
            </button>
            <button
              className="button"
              onClick={async () => {
                await saveStudent({
                  ...student,
                  selectedCareer: dialog.career.id,
                  savedCareers: [
                    ...new Set([...student.savedCareers, dialog.career.id]),
                  ],
                });
                setDialog(null);
                navigate("learn");
                toast.success("Your learning pathway is ready.");
              }}
            >
              {t("plan")}
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {dialog?.type === "lesson" && (
        <LessonDialog
          course={dialog.course}
          progress={progressFor(dialog.course)}
          lang={app.lang}
          onSave={saveProgress}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "trial" && (
        <TrialDialog
          career={dialog.career}
          lang={app.lang}
          onClose={() => setDialog(null)}
          onSave={async (answer, reflection) => {
            await app.save("trial", `trial_${student.id}_${dialog.career.id}`, {
              studentId: student.id,
              careerId: dialog.career.id,
              answer,
              reflection,
              completedAt: new Date().toISOString(),
            });
            toast.success("Your career activity is in your passport.");
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === "application" && (
        <ApplicationDialog
          opportunity={dialog.opportunity}
          profile={student.profile}
          application={
            applications.find(
              (a) => a.opportunityId === dialog.opportunity.id,
            ) || {
              studentId: student.id,
              opportunityId: dialog.opportunity.id,
              status: "Preparing",
              documents: [],
              notes: "",
              updatedAt: new Date().toISOString(),
            }
          }
          onClose={() => setDialog(null)}
          onSave={saveApplication}
        />
      )}
      {dialog?.type === "mentor" && (
        <MentorDialog
          mentor={dialog.mentor}
          onClose={() => setDialog(null)}
          onSave={async (goal) => {
            await app.save("mentor-request", crypto.randomUUID(), {
              studentId: student.id,
              mentorId: dialog.mentor.id,
              goal,
              status: "Awaiting facilitator",
              createdAt: new Date().toISOString(),
            });
            setDialog(null);
            toast.success(
              "Practice request saved for your facilitator. No external message was sent.",
            );
          }}
        />
      )}
      {dialog?.type === "module" && (
        <ModuleDialog
          onClose={() => setDialog(null)}
          onSave={async (course) => {
            await app.save("course", course.id, course);
            setDialog(null);
            toast.success("Your module is available in My learning.");
          }}
        />
      )}
      {dialog?.type === "partner" && (
        <PartnerDialog
          onClose={() => setDialog(null)}
          onSave={async (kind, value) => {
            await app.save(kind, value.id, value);
            setDialog(null);
            toast.success("Community partner record saved.");
          }}
        />
      )}
      {guideOpen && (
        <GuidePanel
          student={student}
          lang={app.lang}
          online={app.online}
          aiAvailable={app.state.aiAvailable}
          onClose={() => setGuideOpen(false)}
          sync={() => app.sync(true)}
        />
      )}
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Compass;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="stat">
      <div className="stat-heading">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong>
        {value}
        <span>↗</span>
      </strong>
      <small>{detail}</small>
    </div>
  );
}
function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </section>
  );
}
function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="search-input">
      <Search size={17} />
      <span className="sr-only">{placeholder}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button aria-label="Clear search" onClick={() => onChange("")}>
          <X size={14} />
        </button>
      )}
    </label>
  );
}
function CourseRow({
  course,
  percent,
  onClick,
  t,
}: {
  course: Course;
  percent: number;
  onClick: () => void;
  t: ReturnType<typeof translator>;
}) {
  return (
    <button className="course-row" onClick={onClick}>
      <span className={`course-art ${course.color}`}>
        <CourseIcon id={course.id} size={31} />
      </span>
      <div className="course-row-main">
        <span className="eyebrow">{course.category}</span>
        <h3>{course.title}</h3>
        <div className="course-meta">
          <span>
            <Clock3 size={12} />
            {course.minutes} {t("minutes")}
          </span>
          <span>
            {percent ? `${percent}% completed` : "Ready when you are"}
          </span>
        </div>
        <ProgressBar value={percent} />
      </div>
      <span className="round-arrow">
        <ArrowRight size={17} />
      </span>
    </button>
  );
}
function ActionStep({
  number,
  title,
  detail,
  onClick,
}: {
  number: string;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button className="action-step" onClick={onClick}>
      <span className="action-number">{number}</span>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      <ChevronRight size={17} />
    </button>
  );
}

function ProfileDialog({
  profile,
  lang,
  onClose,
  onSave,
}: {
  profile: Profile;
  lang: Lang;
  onClose: () => void;
  onSave: (p: Profile) => Promise<void>;
}) {
  const [p, setP] = useState(profile);
  const [busy, setBusy] = useState(false);
  const [interview, setInterview] = useState(false);
  const t = translator(lang);
  const set = (key: keyof Profile, value: any) =>
    setP((old) => ({ ...old, [key]: value }));
  if (interview)
    return (
      <Modal title="Discover your starting point" onClose={onClose} wide>
        <ProfileInterview
          profile={p}
          lang={lang}
          onReview={(value) => {
            setP(value);
            setInterview(false);
          }}
        />
      </Modal>
    );
  return (
    <Modal title={t("profile")} onClose={onClose} wide>
      <p className="subtle">{t("profileHint")}</p>
      <div className="notice neutral">
        <Mic size={19} />
        <div>
          <strong>Prefer a conversation?</strong>
          <p>
            Answer a few guided questions by voice or text, then review your
            profile.
          </p>
          <button
            className="button secondary small"
            type="button"
            onClick={() => setInterview(true)}
          >
            Start guided discovery
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
      <form
        className="profile-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!p.interests.length) {
            toast.error("Choose at least one interest.");
            return;
          }
          setBusy(true);
          try {
            await onSave({ ...p, completed: true });
          } catch {
            toast.error("Profile could not be saved. Please retry.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label>
            {t("name")}
            <input
              required
              maxLength={100}
              value={p.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </label>
          <label>
            {t("age")}
            <input
              type="number"
              min={8}
              max={100}
              value={p.age ?? ""}
              onChange={(e) =>
                set("age", e.target.value ? Number(e.target.value) : null)
              }
            />
          </label>
          <label>
            {t("grade")}
            <select
              value={p.grade}
              onChange={(e) => {
                set("grade", e.target.value);
                set(
                  "education",
                  e.target.value === "Graduation" ? 15 : Number(e.target.value),
                );
              }}
            >
              <option value="8">Grade 8</option>
              <option value="9">Grade 9</option>
              <option value="10">Grade 10</option>
              <option value="11">Grade 11</option>
              <option value="12">Grade 12</option>
              <option value="Graduation">Graduation / college</option>
            </select>
          </label>
          <label>
            {t("district")}
            <input
              maxLength={100}
              value={p.district}
              onChange={(e) => set("district", e.target.value)}
            />
          </label>
          <label>
            {t("state")}
            <input
              maxLength={100}
              value={p.state}
              onChange={(e) => set("state", e.target.value)}
            />
          </label>
          <label>
            {t("language")}
            <select
              value={p.language}
              onChange={(e) => set("language", e.target.value)}
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="mr">मराठी</option>
            </select>
          </label>
        </div>
        <fieldset>
          <legend>{t("interests")}</legend>
          <div className="interest-options">
            {INTERESTS.map((i) => (
              <label
                key={i}
                className={p.interests.includes(i) ? "chosen" : ""}
              >
                <input
                  type="checkbox"
                  checked={p.interests.includes(i)}
                  onChange={() =>
                    set(
                      "interests",
                      p.interests.includes(i)
                        ? p.interests.filter((x) => x !== i)
                        : [...p.interests, i],
                    )
                  }
                />
                {i}
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          {t("goals")}
          <textarea
            value={p.goals}
            maxLength={2000}
            onChange={(e) => set("goals", e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            {t("budget")}
            <input
              type="number"
              min={0}
              max={10000000}
              placeholder={t("unknown")}
              value={p.budget ?? ""}
              onChange={(e) =>
                set(
                  "budget",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </label>
          <label>
            {t("hours")}
            <input
              type="number"
              min={0}
              max={100}
              value={p.hours}
              onChange={(e) => set("hours", Number(e.target.value))}
            />
          </label>
        </div>
        <label>
          {t("income")}
          <input
            type="number"
            min={0}
            max={100000000}
            placeholder={t("unknown")}
            value={p.income ?? ""}
            onChange={(e) =>
              set(
                "income",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={p.canTravel}
            onChange={(e) => set("canTravel", e.target.checked)}
          />
          {t("travel")}
        </label>
        <p className="subtle">
          Your profile is stored in this private workspace and on this device
          for offline access. Avoid using a shared device for sensitive
          information.
        </p>
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            {t("close")}
          </button>
          <button className="button" disabled={busy} type="submit">
            {busy ? "Saving…" : t("saveProfile")}
            <Check size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

function LessonDialog({
  course,
  progress,
  lang,
  onSave,
  onClose,
}: {
  course: Course;
  progress: Progress;
  lang: Lang;
  onSave: (p: Progress) => Promise<void>;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(
    Math.max(
      0,
      course.lessons.findIndex((_, i) => !progress.completed.includes(i)),
    ),
  );
  const [answer, setAnswer] = useState<number | null>(null);
  const [result, setResult] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const t = translator(lang);
  const lesson = course.lessons[index];
  const localized = lang !== "en" ? lesson[lang] : undefined;
  const content = localized || lesson;
  const order = lesson.options.map(
    (_, i) => (i + index + 1) % lesson.options.length,
  );
  function move(i: number) {
    window.speechSynthesis?.cancel();
    setIndex(i);
    setAnswer(null);
    setResult(null);
  }
  return (
    <Modal
      title={course.title}
      onClose={() => {
        window.speechSynthesis?.cancel();
        onClose();
      }}
      wide
    >
      <div className="lesson-layout">
        <aside className="lesson-nav">
          {course.lessons.map((l, i) => (
            <button
              key={i}
              className={index === i ? "current" : ""}
              onClick={() => move(i)}
            >
              {progress.completed.includes(i) ? (
                <CheckCircle2 size={17} />
              ) : (
                <span>{i + 1}</span>
              )}
              {lang !== "en" && l[lang] ? l[lang]!.title : l.title}
            </button>
          ))}
          <div className="lesson-overall">
            <ProgressBar
              value={coursePercent(progress.completed, course.lessons.length)}
            />
            <small>
              {progress.completed.length}/{course.lessons.length}{" "}
              {t("completed")}
            </small>
          </div>
        </aside>
        <article className="lesson-content">
          <span className="eyebrow">
            {t("lesson")} {index + 1} / {course.lessons.length}
          </span>
          <h2>{content.title}</h2>
          {lang !== "en" && !localized && (
            <span className="tag">Lesson content in English</span>
          )}
          <p className="lesson-text">{content.text}</p>
          <button
            className="text-button"
            onClick={() => speak(content.text, localized ? lang : "en")}
          >
            <Volume2 size={16} />
            {t("listen")}
          </button>
          <div className="quiz">
            <h3>{content.question}</h3>
            {order.map((originalIndex) => (
              <label
                className={`quiz-option ${answer === originalIndex ? "checked" : ""}`}
                key={originalIndex}
              >
                <input
                  type="radio"
                  name="lesson-answer"
                  checked={answer === originalIndex}
                  onChange={() => {
                    setAnswer(originalIndex);
                    setResult(null);
                  }}
                />
                <span>{content.options[originalIndex]}</span>
              </label>
            ))}
            {result !== null && (
              <div className={`quiz-feedback ${result ? "success" : ""}`}>
                <strong>{result ? t("correct") : t("retry")}</strong>
                <p>{content.explanation}</p>
              </div>
            )}
            <div className="modal-actions">
              <button
                className="button secondary"
                onClick={() => move(Math.max(0, index - 1))}
                disabled={index === 0}
              >
                <ArrowLeft size={15} />
                {t("back")}
              </button>
              {result === true || progress.completed.includes(index) ? (
                index < course.lessons.length - 1 ? (
                  <button className="button" onClick={() => move(index + 1)}>
                    {t("next")}
                    <ArrowRight size={15} />
                  </button>
                ) : (
                  <button className="button" onClick={onClose}>
                    {t("completed")}
                    <Check size={16} />
                  </button>
                )
              ) : (
                <button
                  className="button"
                  disabled={answer === null || busy}
                  onClick={async () => {
                    if (answer === null) return;
                    setBusy(true);
                    try {
                      const correct = answer === lesson.correct;
                      await onSave({
                        ...progress,
                        completed: correct
                          ? [...new Set([...progress.completed, index])]
                          : progress.completed,
                        attempts: {
                          ...progress.attempts,
                          [index]: (progress.attempts[index] || 0) + 1,
                        },
                        updatedAt: new Date().toISOString(),
                      });
                      setResult(correct);
                      if (correct) toast.success("Learning step saved.");
                    } catch {
                      toast.error(
                        "Your answer could not be saved. Please retry.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t("check")}
                  <Check size={15} />
                </button>
              )}
            </div>
          </div>
          <SourceLink url={course.source}>{course.sourceLabel}</SourceLink>
        </article>
      </div>
    </Modal>
  );
}

function TrialDialog({
  career,
  lang,
  onSave,
  onClose,
}: {
  career: Career;
  lang: Lang;
  onSave: (a: number, r: string) => Promise<void>;
  onClose: () => void;
}) {
  const [answer, setAnswer] = useState<number | null>(null);
  const [reflection, setReflection] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const t = translator(lang);
  return (
    <Modal
      title={`${t("trial")} · ${careerTitle(career, lang)}`}
      onClose={onClose}
    >
      <div className={`detail-art ${career.color}`}>
        <CourseIcon id={career.courseIds[0]} size={36} />
        <span>5-minute exploration · English activity</span>
      </div>
      <p className="subtle">
        This activity introduces a way of thinking about the work. It does not
        measure your aptitude or certify practical competence.
      </p>
      <h3>{career.trial.prompt}</h3>
      {career.trial.options.map((option, i) => (
        <label
          className={`quiz-option ${answer === i ? "checked" : ""}`}
          key={option}
        >
          <input
            type="radio"
            name="trial"
            checked={answer === i}
            onChange={() => {
              setAnswer(i);
              setShow(false);
            }}
          />
          {option}
        </label>
      ))}
      {show && (
        <div className="quiz-feedback success">
          <p>{career.trial.explanation}</p>
        </div>
      )}
      <label className="space-top">
        {t("reflection")}
        <textarea
          value={reflection}
          maxLength={4000}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="I enjoyed… I would like to explore…"
        />
      </label>
      <div className="modal-actions">
        <button
          className="button secondary"
          disabled={answer === null}
          onClick={() => setShow(true)}
        >
          Explore the reasoning
        </button>
        <button
          className="button"
          disabled={answer === null || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(answer!, reflection);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("submit")}
          <Check size={16} />
        </button>
      </div>
    </Modal>
  );
}

function ApplicationDialog({
  opportunity: o,
  profile,
  application,
  onSave,
  onClose,
}: {
  opportunity: Opportunity;
  profile: Profile;
  application: Application;
  onSave: (a: Application) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(application);
  const [busy, setBusy] = useState(false);
  const eligibility = checkEligibility(o, profile);
  return (
    <Modal title={o.title} onClose={onClose}>
      <div className="tag-row">
        <span className="tag">{o.type}</span>
        <span className={`tag ${o.sample ? "warning" : "green"}`}>
          {o.sample
            ? "Demonstration listing"
            : o.sourceLabel === "Community partner link"
              ? "Community listing · verify details"
              : "Official program directory"}
        </span>
      </div>
      <p className="lead">{o.description}</p>
      <div className="detail-facts">
        <span>
          Provider<strong>{o.provider}</strong>
        </span>
        <span>
          Location<strong>{o.location}</strong>
        </span>
        <span>
          Application window
          <strong>{o.deadline || "Check current provider dates"}</strong>
        </span>
      </div>
      <h3>{eligibility.label}</h3>
      {eligibility.checks.map((check) => (
        <div className="eligibility-row" key={check.field}>
          <span
            className={
              check.result === "pass"
                ? "text-green"
                : check.result === "fail"
                  ? "text-red"
                  : "text-muted"
            }
          >
            {check.result === "pass" ? (
              <CheckCircle2 size={18} />
            ) : check.result === "fail" ? (
              <X size={18} />
            ) : (
              <MessageCircle size={18} />
            )}
          </span>
          <div>
            <strong>{check.label}</strong>
            <p>{check.description}</p>
            {check.result === "unknown" && (
              <small>
                Add this information to your profile to evaluate the sample
                rule.
              </small>
            )}
          </div>
        </div>
      ))}
      {!o.sample && (
        <p className="subtle">
          Requirements vary across listings. This directory has not been marked
          eligible automatically. Read the official scheme or course details.
        </p>
      )}
      <h3>Application preparation checklist</h3>
      <p className="subtle">
        Track readiness here. Do not upload personal documents to this
        demonstration.
      </p>
      {o.documents.map((document) => (
        <label className="document-check" key={document}>
          <input
            type="checkbox"
            checked={value.documents.includes(document)}
            onChange={() =>
              setValue((old) => ({
                ...old,
                documents: old.documents.includes(document)
                  ? old.documents.filter((d) => d !== document)
                  : [...old.documents, document],
              }))
            }
          />
          <span>{document}</span>
        </label>
      ))}
      <label className="space-top">
        Your notes
        <textarea
          maxLength={3000}
          value={value.notes}
          onChange={(e) =>
            setValue((old) => ({ ...old, notes: e.target.value }))
          }
        />
      </label>
      <label>
        Tracking status
        <select
          value={value.status}
          onChange={(e) =>
            setValue((old) => ({
              ...old,
              status: e.target.value as Application["status"],
            }))
          }
        >
          <option>Preparing</option>
          <option>Ready to apply</option>
          <option>Submitted externally</option>
          <option>Accepted</option>
        </select>
      </label>
      <p className="subtle">
        Submitted and accepted statuses are self-reported. Saving does not
        submit an application.{" "}
        {o.sample
          ? "This is a sample listing; no real grant or placement is available."
          : "Apply on the official provider's website."}
      </p>
      {o.source && <SourceLink url={o.source}>{o.sourceLabel}</SourceLink>}
      <div className="modal-actions">
        <span className="subtle">
          Directory source checked {o.verifiedAt}; verify live requirements.
        </span>
        <button
          className="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave({ ...value, updatedAt: new Date().toISOString() });
              toast.success("Application checklist saved.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Check size={16} />
          Save checklist
        </button>
      </div>
    </Modal>
  );
}

function MentorDialog({
  mentor,
  onSave,
  onClose,
}: {
  mentor: Mentor;
  onSave: (g: string) => Promise<void>;
  onClose: () => void;
}) {
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Prepare a question for ${mentor.name}`} onClose={onClose}>
      <div className="notice neutral">
        {mentor.sample
          ? "Demonstration profile. "
          : "Facilitator-added community mentor. "}
        This request is saved in your learning centre and is not sent to an
        external person.
      </div>
      <p>
        A useful mentoring question names what you're working on and the help
        you need.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!goal.trim()) return;
          setBusy(true);
          try {
            await onSave(goal.trim());
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Your question
          <textarea
            required
            maxLength={1900}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="I'm exploring design. Could we review my first poster together?"
          />
        </label>
        <div className="modal-actions">
          <button
            className="button"
            disabled={busy || !goal.trim()}
            type="submit"
          >
            Save practice request
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ModuleDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (c: Course) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [price, setPrice] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Create a local learning module" onClose={onClose} wide>
      <p className="subtle">
        Add original content you have permission to use. Published modules are
        available inside your private workspace.
      </p>
      <form
        className="profile-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSave({
              id: crypto.randomUUID(),
              title,
              subtitle: "An original module from your facilitator",
              category: "Community learning",
              color: "mint",
              minutes: 10,
              skills: ["Community learning"],
              source: "https://www.diksha.gov.in/",
              sourceLabel:
                "Explore further learning on DIKSHA (not the source of this module)",
              price,
              creator: "Workspace facilitator",
              published: true,
              custom: true,
              lessons: [
                {
                  title,
                  text,
                  question,
                  options,
                  correct,
                  explanation:
                    explanation ||
                    "Discuss the reasoning with your facilitator.",
                },
              ],
            });
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Module title
          <input
            required
            maxLength={180}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Learning content
          <textarea
            required
            maxLength={12000}
            rows={7}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Explain one useful skill with an example and a practice step."
          />
        </label>
        <label>
          Check-understanding question
          <input
            required
            maxLength={500}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </label>
        <div className="form-grid">
          {options.map((option, i) => (
            <label key={i}>
              Answer option {i + 1}
              <input
                required
                maxLength={300}
                value={option}
                onChange={(e) =>
                  setOptions((old) =>
                    old.map((v, n) => (n === i ? e.target.value : v)),
                  )
                }
              />
            </label>
          ))}
          <label>
            Correct answer
            <select
              value={correct}
              onChange={(e) => setCorrect(Number(e.target.value))}
            >
              {options.map((_, i) => (
                <option key={i} value={i}>
                  Option {i + 1}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Explain the answer
          <textarea
            maxLength={2000}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />
        </label>
        <label>
          Listed price (₹; 0 means free)
          <input
            type="number"
            min={0}
            max={1000000}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
        </label>
        <p className="subtle">
          Pricing is saved for your module. No payment gateway is connected;
          learners can preview the content.
        </p>
        <div className="modal-actions">
          <button className="button" disabled={busy} type="submit">
            Publish to my workspace
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

function speak(text: string, lang: Lang) {
  if (!("speechSynthesis" in window)) {
    toast.info("Speech output is not supported on this device.");
    return;
  }
  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = lang === "hi" ? "hi-IN" : lang === "mr" ? "mr-IN" : "en-IN";
  speech.rate = 0.92;
  const voice = window.speechSynthesis
    .getVoices()
    .find((v) => v.lang.startsWith(speech.lang.slice(0, 2)));
  if (voice) speech.voice = voice;
  else if (lang !== "en")
    toast.info("Install a matching device voice for the best pronunciation.");
  speech.onerror = () =>
    toast.info("Speech output could not start. Check your device voices.");
  window.speechSynthesis.speak(speech);
}

function GuidePanel({
  student,
  lang,
  online,
  aiAvailable,
  sync,
  onClose,
}: {
  student: Student;
  lang: Lang;
  online: boolean;
  aiAvailable: boolean;
  sync: () => Promise<void>;
  onClose: () => void;
}) {
  const t = translator(lang);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [messages, setMessages] = useState<
    {
      role: string;
      text: string;
      mode?: string;
      sources?: { title: string; url: string }[];
    }[]
  >([]);
  const [recognition, setRecognition] = useState<any>(null);
  useEffect(
    () => () => {
      recognition?.abort();
      window.speechSynthesis?.cancel();
    },
    [recognition],
  );
  async function ask(value: string) {
    if (!value.trim() || busy) return;
    setMessage("");
    setBusy(true);
    setMessages((old) => [...old, { role: "user", text: value }]);
    try {
      if (!online) {
        const results = retrieve(value, student.profile);
        setMessages((old) => [
          ...old,
          {
            role: "assistant",
            text: `${results[0].title}\n\n${results[0].text.slice(0, 700)}\n\nSaved catalogue guidance. Connect to ask the AI guide or check current opportunity details.`,
            mode: "offline catalogue",
            sources: results.map((r) => ({ title: r.title, url: r.url })),
          },
        ]);
        return;
      }
      await sync();
      const response = await fetch("/api/guide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          message: value,
          language: lang,
        }),
      });
      const result = (await response.json()) as any;
      if (!response.ok) throw new Error(result.error || "Guide unavailable.");
      setMessages((old) => [
        ...old,
        {
          role: "assistant",
          text: result.answer,
          mode:
            result.mode === "ollama"
              ? "Local AI · source-grounded"
              : "Catalogue retrieval",
          sources: result.sources,
        },
      ]);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "The guide could not respond.",
      );
      setMessages((old) => [
        ...old,
        {
          role: "assistant",
          text: "I couldn't complete that request. Your learning catalogue is still available. Please try again.",
          mode: "Connection issue",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }
  function startVoice() {
    if (listening) {
      recognition?.stop();
      setListening(false);
      return;
    }
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.info(
        "Voice input is unavailable in this browser. You can type your question.",
      );
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = lang === "hi" ? "hi-IN" : lang === "mr" ? "mr-IN" : "en-IN";
    rec.interimResults = false;
    rec.onresult = (event: any) => {
      setMessage(event.results[0][0].transcript);
      setListening(false);
    };
    rec.onerror = () => {
      setListening(false);
      toast.info(
        "Voice input could not start. Check microphone access and connectivity.",
      );
    };
    rec.onend = () => setListening(false);
    setRecognition(rec);
    try {
      rec.start();
      setListening(true);
    } catch {
      toast.info("Microphone unavailable. Type your question instead.");
    }
  }
  return (
    <Modal
      title={t("guide")}
      onClose={() => {
        recognition?.abort();
        window.speechSynthesis?.cancel();
        onClose();
      }}
    >
      <div className="guide-intro">
        <span className="guide-logo">
          <Sparkles size={23} />
        </span>
        <div>
          <h3>A little guidance for your next step.</h3>
          <p>Ask about careers, learning or finding support.</p>
        </div>
      </div>
      <div className="guide-messages" aria-live="polite">
        {!messages.length && (
          <div className="guide-suggestions">
            {[
              "What careers connect to my interests?",
              "How can I find a scholarship?",
              "What should I learn next?",
            ].map((q) => (
              <button key={q} onClick={() => void ask(q)}>
                {q}
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div className={`chat-message ${m.role}`} key={i}>
            {m.mode && <small>{m.mode}</small>}
            <p>{m.text}</p>
            {m.role === "assistant" && (
              <>
                <button
                  className="text-button"
                  onClick={() => speak(m.text, lang)}
                >
                  <Volume2 size={14} />
                  {t("listen")}
                </button>
                {m.sources && (
                  <div className="chat-sources">
                    {m.sources.map((s, n) => (
                      <SourceLink key={`${n}-${s.title}`} url={s.url}>
                        {s.title}
                      </SourceLink>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {busy && (
          <div className="chat-message assistant">
            <span className="thinking">Finding a useful next step…</span>
          </div>
        )}
      </div>
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(message);
        }}
      >
        <button
          type="button"
          className={`icon-button ${listening ? "recording" : ""}`}
          aria-label={listening ? "Stop recording" : t("voice")}
          onClick={startVoice}
        >
          <Mic size={19} />
        </button>
        <input
          aria-label="Your question"
          value={message}
          maxLength={2000}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={listening ? "Listening…" : t("ask")}
        />
        <button
          className="button icon-only"
          type="submit"
          aria-label={t("send")}
          disabled={busy || !message.trim()}
        >
          <Send size={17} />
        </button>
      </form>
      <p className="subtle tiny">
        {!online
          ? "Offline: saved catalogue guidance only."
          : aiAvailable
            ? "Uses the configured model when available, with an explicit catalogue fallback."
            : "Catalogue guidance is available. A model endpoint is not configured."}{" "}
        Voice availability depends on your device and may need internet. Always
        verify provider requirements.
      </p>
    </Modal>
  );
}

function SettingsPage({
  app,
  t,
  onPrepare,
  offlineStatus,
}: {
  offlineStatus: string;
  app: ReturnType<typeof useDisha>;
  t: ReturnType<typeof translator>;
  onPrepare: () => Promise<void>;
}) {
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => {
    void offlineDb.meta
      .toArray()
      .then((rows) =>
        setConflicts(
          rows.filter((r) =>
            r.key.startsWith(`conflict:${app.state?.workspace.id}:`),
          ),
        ),
      );
  }, [app.state?.workspace.id]);
  return (
    <>
      <PageHeading
        eyebrow="A SPACE THAT WORKS FOR YOU"
        title={t("settings")}
        subtitle="Choose your language, manage offline learning and control this device's data."
      />
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-icon">
            <Download size={23} />
          </div>
          <h3>Keep learning, even when the connection doesn't.</h3>
          <p>
            Profiles, the learning catalogue, activities and saved work are
            stored on this device. New AI responses and fresh opportunity
            information need a connection.
          </p>
          <button className="button" onClick={() => void onPrepare()}>
            <Download size={16} />
            {t("download")}
          </button>
          <p className="subtle space-top" role="status">
            {offlineStatus}
          </p>
          <div className="simple-row space-top">
            <span>Sync queue</span>
            <span className="tag">{app.pending} pending</span>
          </div>
          <button
            className="text-button"
            onClick={() => void app.sync()}
            disabled={!app.online || app.syncing}
          >
            <RefreshCw size={15} />
            {app.syncing ? "Syncing…" : t("sync")}
          </button>
        </section>
        <section className="panel">
          <div className="panel-icon">
            <MessageCircle size={23} />
          </div>
          <h3>{t("language")}</h3>
          <p>
            Navigation supports English, Hindi and Marathi. Translated lessons
            are labelled; some course content remains in English.
          </p>
          <label htmlFor="settings-language">Interface language</label>
          <select
            id="settings-language"
            value={app.lang}
            onChange={(e) => app.changeLang(e.target.value as Lang)}
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
            <option value="mr">मराठी</option>
          </select>
          <p className="subtle space-top">
            Voice input and output use browser/device speech features. No
            guaranteed offline speech recognition is claimed.
          </p>
        </section>
        <section className="panel">
          <div className="panel-icon">
            <ShieldCheck size={23} />
          </div>
          <h3>Your private workspace</h3>
          <p>{app.state?.user.email}</p>
          <p>
            Only the signed-in owner can access these server records. Switching
            a learner changes who you are supporting within your own workspace.
          </p>
          <p className="subtle">
            Local offline records can be accessed by someone using the same
            unlocked browser. Clear this device before sharing it.
          </p>
          <button
            className="button secondary"
            onClick={() => setConfirmClear(true)}
          >
            {t("clear")}
          </button>
          <button
            className="text-button space-top"
            onClick={async () => {
              if (app.pending) {
                toast.error("Sync your pending changes before signing out.");
                return;
              }
              await clearOfflineData();
              window.location.assign("/signout-with-chatgpt?return_to=/");
            }}
          >
            <LogOut size={16} />
            {t("logout")}
          </button>
        </section>
        <section className="panel">
          <div className="panel-icon">
            <Sprout size={23} />
          </div>
          <h3>Built on shared foundations</h3>
          <p>
            React, Vinext, Drizzle, Dexie, MiniSearch, json-logic-js and Lucide
            provide the application foundations.
          </p>
          <p>
            Kolibri inspired offline learning and facilitator workflows. Career
            and application flows draw on the research into Quest, iDreamCareer
            and Haqdarshak.
          </p>
          <SourceLink url="https://github.com/learningequality/kolibri">
            Explore Kolibri
          </SourceLink>
        </section>
      </div>
      {conflicts.length > 0 && (
        <div className="panel space-top">
          <h3>Retained conflict drafts</h3>
          <p>
            A different device saved a newer record. Review your retained draft
            before replacing the current version.
          </p>
          {conflicts.map((c) => (
            <div className="conflict-draft" key={c.key}>
              <strong>
                {c.value.local.kind} · {c.value.local.id}
              </strong>
              <pre>{JSON.stringify(c.value.local.data, null, 2)}</pre>
              <button
                className="button secondary small"
                onClick={async () => {
                  await app.save(
                    c.value.local.kind,
                    c.value.local.id,
                    c.value.local.data,
                  );
                  await offlineDb.meta.delete(c.key);
                  setConflicts((old) => old.filter((x) => x.key !== c.key));
                  toast.success("Your reviewed draft was queued for saving.");
                }}
              >
                Use this draft
              </button>
            </div>
          ))}
        </div>
      )}
      {confirmClear && (
        <Modal
          title="Clear data from this device?"
          onClose={() => setConfirmClear(false)}
        >
          <p>
            Saved offline records and any unsynced changes will be removed from
            this browser. Synced server records remain available after signing
            in again.
          </p>
          <p className="notice">
            {app.pending} changes currently waiting to sync.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setConfirmClear(false)}
            >
              Keep my data
            </button>
            <button
              className="button danger"
              onClick={async () => {
                await clearOfflineData();
                window.location.reload();
              }}
            >
              Clear this device
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
