"use client";
import { useUiText } from "./ui-language";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  RefreshCw,
  CalendarDays,
  CreditCard,
  Copy,
  Send,
  Plus,
} from "lucide-react";
import { apiCall } from "@/lib/client-api";
import { offlineDb } from "@/lib/offline";
import { isFacilitator } from "@/lib/access";
import type { Course, Opportunity } from "@/lib/types";
import type { useDisha } from "./use-disha";
import PartnerDialog from "./partner-dialog";
type App = ReturnType<typeof useDisha>;
function useAction() {
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Request failed. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}
export function WorkspaceControls({ app }: { app: App }) {
  const ui = useUiText();

  const { busy, run } = useAction();
  const [token, setToken] = useState("");
  const state = app.state!;
  async function switchTo(id: string) {
    if (!app.online) throw new Error("Connect before switching centres.");
    await app.sync(true);
    if (
      await offlineDb.outbox
        .where("workspace")
        .equals(state.workspace.id)
        .count()
    )
      throw new Error(
        "Save or resolve your pending changes before switching centres.",
      );
    localStorage.setItem("disha-workspace", id);
    await app.initialize();
  }
  return (
    <section className="panel community-panel">
      <h2>
        <Users size={20} />{" "}
        {app.lang === "hi"
          ? "खाता और केंद्र"
          : app.lang === "mr"
            ? "खाते आणि केंद्र"
            : "Account & learning centre"}
      </h2>
      <p>
        {state.user.name} · <strong>{ui(state.access.role)}</strong>
      </p>
      <label>
        {ui("Learning centre")}
        <select
          value={state.workspace.id}
          disabled={busy}
          onChange={(e) => void run(() => switchTo(e.target.value))}
        >
          {state.workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} · {ui(w.role)}
            </option>
          ))}
        </select>
      </label>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            if (!app.online) throw new Error("Connect to join a centre.");
            const r = await apiCall("/api/team", {
              action: "join",
              token: token.trim(),
            });
            setToken("");
            await switchTo(r.workspaceId);
            toast.success("Centre joined.");
          });
        }}
      >
        <label>
          {ui("Invitation code")}
          <input
            aria-label={ui("Invitation code")}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            maxLength={64}
            autoComplete="off"
            placeholder={ui("Paste your 48-hour invitation code")}
            required
          />
        </label>
        <button
          className="button secondary"
          disabled={busy || token.trim().length !== 64}
        >
          {ui("Join centre")}
        </button>
      </form>
      <small className="subtle">
        {ui(
          "Invitations are bound to your signed-in email. Site access and centre membership are separate. Ask the site owner for access if the sign-in gate blocks you.",
        )}
      </small>
    </section>
  );
}

export default function CommunityPage({ app }: { app: App }) {
  const ui = useUiText();

  const state = app.state!;
  const role = state.access.role;
  const fac = isFacilitator(state.access);
  const [tab, setTab] = useState("Sessions");
  const [team, setTeam] = useState<any>({
    members: [],
    invites: [],
    audit: [],
  });
  const [mentoring, setMentoring] = useState<any>({
    mentors: [],
    sessions: [],
    messages: [],
  });
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("student");
  const [subject, setSubject] = useState("");
  const [createdToken, setCreatedToken] = useState("");
  const [studentId, setStudentId] = useState(app.studentId);
  const [mentorId, setMentorId] = useState("");
  const [starts, setStarts] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [goal, setGoal] = useState("");
  const [applyId, setApplyId] = useState("");
  const [applicationMessage, setApplicationMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [review, setReview] = useState<Record<string, string>>({});
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [availability, setAvailability] = useState("");
  const { busy, run } = useAction();
  const students = state.records.filter((r) => r.kind === "student");
  const mentorProfiles = state.records.filter((r) => r.kind === "mentor");
  const opportunities = state.records.filter((r) => r.kind === "opportunity");
  const intake = opportunities.filter((r) => r.data.intake === "disha");
  async function refresh(selected = sessionId) {
    if (!app.online) {
      setErrors([
        "Connect to load live sessions, applications and membership. Saved lessons remain available offline.",
      ]);
      return;
    }
    const tasks: [string, Promise<any>, (r: any) => void][] = [
      [
        "Mentoring",
        apiCall(
          `/api/mentoring${selected ? `?session=${encodeURIComponent(selected)}` : ""}`,
        ),
        setMentoring,
      ],
    ];
    if (role !== "mentor")
      tasks.push([
        "Applications",
        apiCall("/api/submissions"),
        (r) => setSubmissions(r.submissions),
      ]);
    if (role === "owner")
      tasks.push(["Membership", apiCall("/api/team"), setTeam]);
    const results = await Promise.allSettled(tasks.map((t) => t[1]));
    const failures: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") tasks[i][2](r.value);
      else
        failures.push(`${tasks[i][0]}: ${r.reason?.message || "Unavailable"}`);
    });
    setErrors(failures);
  }
  useEffect(() => {
    void refresh();
  }, [state.workspace.id, state.access.role, app.online]);
  const tabs = [
    "Sessions",
    ...(role !== "mentor" ? ["Applications"] : []),
    ...(role === "owner" ? ["Team", "Integrations"] : []),
    ...(role === "student" || fac ? ["Payments"] : []),
  ];
  return (
    <div className="community-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">{ui("YOUR COMMUNITY")}</span>
          <h1>
            {app.lang === "hi"
              ? "मिलकर आगे बढ़ें"
              : app.lang === "mr"
                ? "एकत्र पुढे चला"
                : "Grow together"}
          </h1>
          <p>
            {ui(
              "Connected accounts, mentor sessions and partner applications.",
            )}
          </p>
        </div>
        <button
          className="button secondary"
          disabled={busy || !app.online}
          onClick={() => void run(() => refresh())}
        >
          <RefreshCw size={16} />
          {ui("Refresh")}
        </button>
      </section>
      <WorkspaceControls app={app} />
      {errors.map((e) => (
        <p className="notice" role="status" key={e}>
          {e}
        </p>
      ))}
      <div
        className="tab-row"
        role="group"
        aria-label={ui("Community sections")}
      >
        {tabs.map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {ui(t)}
          </button>
        ))}
      </div>
      {tab === "Team" && role === "owner" && (
        <div className="community-stack">
          <section className="panel community-panel">
            <h2>{ui("Invite a person")}</h2>
            <p>
              {ui(
                "First add a learner or mentor profile in Learning centre → Partners. Invite a separate signed-in account to the matching profile. Teachers can manage centre records; only you manage membership.",
              )}
            </p>
            <form
              className="profile-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const r = await apiCall("/api/team", {
                    action: "invite",
                    email,
                    role: inviteRole,
                    subjectId: subject || null,
                  });
                  setCreatedToken(r.token);
                  await refresh();
                });
              }}
            >
              <div className="form-grid">
                <label>
                  {ui("Email")}
                  <input
                    required
                    type="email"
                    value={email}
                    maxLength={254}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label>
                  {ui("Role")}
                  <select
                    value={inviteRole}
                    onChange={(e) => {
                      setInviteRole(e.target.value);
                      setSubject("");
                    }}
                  >
                    {["student", "teacher", "mentor", "employer"].map((r) => (
                      <option key={r} value={r}>{ui(r)}</option>
                    ))}
                  </select>
                </label>
              </div>
              {["student", "mentor"].includes(inviteRole) && (
                <label>
                  {ui("Profile to link")}
                  <select
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  >
                    <option value="">{ui("Choose a profile")}</option>
                    {(inviteRole === "student" ? students : mentorProfiles).map(
                      (r) => (
                        <option value={r.id} key={r.id}>
                          {r.data.profile?.name || r.data.name}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              )}
              <button className="button" disabled={busy || !app.online}>
                {ui("Create invitation")}
              </button>
            </form>
            {createdToken && (
              <div className="notice neutral invite-result">
                <strong>
                  {ui(
                    "Copy this code now. It expires in 48 hours and is shown only here.",
                  )}
                </strong>
                <code>{createdToken}</code>
                <button
                  className="button secondary"
                  onClick={() =>
                    void run(async () => {
                      await navigator.clipboard.writeText(createdToken);
                      toast.success("Code copied.");
                    })
                  }
                >
                  <Copy size={15} />
                  {ui("Copy code")}
                </button>
              </div>
            )}
          </section>
          <section className="panel community-panel">
            <h2>{ui("People & invitations")}</h2>
            {team.members.map((m: any) => (
              <div className="simple-row" key={m.id}>
                <div>
                  <strong>{m.name}</strong>
                  <small>
                    {m.email} · {ui(m.role)}
                    {m.revokedAt ? " · revoked" : ""}
                  </small>
                </div>
                {!m.revokedAt && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await apiCall("/api/team", {
                          action: "revoke-member",
                          id: m.id,
                        });
                        await refresh();
                      })
                    }
                  >
                    {ui("Revoke access")}
                  </button>
                )}
              </div>
            ))}
            {team.invites.map((i: any) => (
              <div className="simple-row" key={i.id}>
                <div>
                  <strong>{i.email}</strong>
                  <small>
                    {i.role} ·{" "}
                    {i.claimedBy
                      ? "Joined"
                      : i.revokedAt
                        ? "Revoked"
                        : new Date(i.expiresAt) < new Date()
                          ? "Expired"
                          : "Awaiting acceptance"}
                  </small>
                </div>
                {!i.claimedBy && !i.revokedAt && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await apiCall("/api/team", {
                          action: "revoke-invite",
                          id: i.id,
                        });
                        await refresh();
                      })
                    }
                  >
                    {ui("Revoke code")}
                  </button>
                )}
              </div>
            ))}
            {!team.members.length && !team.invites.length && (
              <p className="subtle">
                {ui("No invitations yet. Your owner account remains active.")}
              </p>
            )}
          </section>
          <section className="panel community-panel">
            <h2>{ui("Recent access & workflow activity")}</h2>
            {team.audit.map((a: any, i: number) => (
              <div className="simple-row" key={i}>
                <strong>{a.action}</strong>
                <small>{new Date(a.createdAt).toLocaleString()}</small>
              </div>
            ))}
          </section>
        </div>
      )}
      {tab === "Sessions" && (
        <div className="community-stack">
          {role === "mentor" && (
            <section className="panel community-panel">
              <h2>{ui("Your mentor profile")}</h2>
              <p>
                {ui(
                  "Publish a short availability note. A session is reserved only after you confirm it below.",
                )}
              </p>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const r = mentorProfiles.find(
                      (m) => m.id === state.access.subjectId,
                    );
                    if (!r) throw new Error("Linked mentor profile not found.");
                    await app.save("mentor", r.id, {
                      ...r.data,
                      availability,
                      onboarded: true,
                    });
                    await app.sync(true);
                    toast.success("Availability saved.");
                  });
                }}
              >
                <label>
                  {ui("Availability")}
                  <input
                    value={availability}
                    maxLength={500}
                    onChange={(e) => setAvailability(e.target.value)}
                    placeholder={ui("Saturdays, 10 am–12 noon IST")}
                    required
                  />
                </label>
                <button className="button" disabled={busy}>
                  {ui("Save availability")}
                </button>
              </form>
            </section>
          )}
          {(fac || role === "student") && (
            <section className="panel community-panel">
              <h2>
                <CalendarDays size={20} />
                {ui("Propose a mentoring session")}
              </h2>
              {!mentoring.mentors.length ? (
                <p>
                  {ui(
                    "No mentors have joined this centre yet. The owner can invite a community mentor from Team.",
                  )}
                </p>
              ) : (
                <form
                  className="profile-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await apiCall("/api/mentoring", {
                        action: "propose",
                        studentId: fac ? studentId : state.access.subjectId,
                        mentorId,
                        startsAt: new Date(starts).toISOString(),
                        minutes,
                        goal,
                      });
                      setGoal("");
                      await refresh();
                      toast.success(
                        "Session proposed. Your mentor can confirm it here.",
                      );
                    });
                  }}
                >
                  <div className="form-grid">
                    {fac && (
                      <label>
                        {ui("Learner")}
                        <select
                          value={studentId}
                          onChange={(e) => setStudentId(e.target.value)}
                          required
                        >
                          <option value="">{ui("Choose learner")}</option>
                          {students.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.data.profile.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label>
                      {ui("Mentor")}
                      <select
                        value={mentorId}
                        onChange={(e) => setMentorId(e.target.value)}
                        required
                      >
                        <option value="">{ui("Choose mentor")}</option>
                        {mentoring.mentors.map((m: any) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ·{" "}
                            {m.availability || "Confirm availability"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {ui("Start time (your device timezone)")}
                      <input
                        type="datetime-local"
                        value={starts}
                        onChange={(e) => setStarts(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      {ui("Minutes")}
                      <select
                        value={minutes}
                        onChange={(e) => setMinutes(Number(e.target.value))}
                      >
                        {[15, 30, 45, 60].map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    {ui("Your goal")}
                    <textarea
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      maxLength={2000}
                      required
                    />
                  </label>
                  <button className="button" disabled={busy || !app.online}>
                    {ui("Propose session")}
                  </button>
                </form>
              )}
            </section>
          )}
          <section className="panel community-panel">
            <h2>{ui("Your sessions")}</h2>
            {!mentoring.sessions.length && (
              <p className="subtle">
                {ui(
                  "Confirmed and proposed sessions will appear here. Refresh to see replies.",
                )}
              </p>
            )}
            {mentoring.sessions.map((s: any) => (
              <article
                key={s.id}
                className={`session-card ${sessionId === s.id ? "selected" : ""}`}
              >
                <span className="tag">{ui(s.status)}</span>
                <h3>
                  {s.student_name} & {s.mentor_name}
                </h3>
                <p>
                  {new Date(s.starts_at).toLocaleString()} · {s.minutes}
                  {ui("min")}
                </p>
                <p>{s.goal}</p>
                <div className="button-row">
                  <button
                    className="button secondary small"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        setSessionId(s.id);
                        await refresh(s.id);
                      })
                    }
                  >
                    {ui("Open conversation")}
                  </button>
                  {!["completed", "cancelled"].includes(s.status) && (
                    <>
                      {(fac || role === "mentor") &&
                        s.status === "proposed" && (
                          <button
                            className="button small"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await apiCall("/api/mentoring", {
                                  action: "status",
                                  id: s.id,
                                  status: "confirmed",
                                });
                                await refresh();
                              })
                            }
                          >
                            {ui("Confirm time")}
                          </button>
                        )}
                      {(fac || role === "mentor") &&
                        s.status === "confirmed" &&
                        new Date(s.starts_at) <= new Date() && (
                          <button
                            className="button small"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await apiCall("/api/mentoring", {
                                  action: "status",
                                  id: s.id,
                                  status: "completed",
                                });
                                await refresh();
                              })
                            }
                          >
                            {ui("Mark complete")}
                          </button>
                        )}
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await apiCall("/api/mentoring", {
                              action: "status",
                              id: s.id,
                              status: "cancelled",
                            });
                            await refresh();
                          })
                        }
                      >
                        {ui("Cancel session")}
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </section>
          {sessionId && (
            <section className="panel community-panel">
              <h2>{ui("Session conversation")}</h2>
              <p className="subtle">
                {ui(
                  "Visible to this learner, their mentor and centre facilitators. Share only information needed for this session.",
                )}
              </p>
              <div className="session-messages" aria-live="polite">
                {mentoring.messages.map((m: any) => (
                  <div key={m.id}>
                    <strong>{m.senderName}</strong>
                    <p>{m.text}</p>
                    <small>{new Date(m.createdAt).toLocaleString()}</small>
                  </div>
                ))}
              </div>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await apiCall("/api/mentoring", {
                      action: "message",
                      id: sessionId,
                      text: message,
                    });
                    setMessage("");
                    await refresh();
                  });
                }}
              >
                <label>
                  {ui("Message")}
                  <textarea
                    maxLength={2000}
                    value={message}
                    required
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </label>
                <button className="button" disabled={busy || !app.online}>
                  <Send size={16} />
                  {ui("Send")}
                </button>
              </form>
            </section>
          )}
        </div>
      )}
      {tab === "Applications" && (
        <div className="community-stack">
          {role === "employer" && (
            <section className="panel community-panel">
              <h2>{ui("Partner opportunities")}</h2>
              <p>
                {ui(
                  "Publish your organisation's opportunity. Learners can submit a short application to your account in this centre.",
                )}
              </p>
              <button className="button" onClick={() => setPartnerOpen(true)}>
                <Plus size={16} />
                {ui("Publish opportunity")}
              </button>
              {opportunities
                .filter((o) => o.data.partnerUserId === state.user.userId)
                .map((o) => (
                  <div className="simple-row" key={o.id}>
                    {o.data.title}
                  </div>
                ))}
            </section>
          )}
          {(fac || role === "student") && (
            <section className="panel community-panel">
              <h2>{ui("Apply to a connected partner")}</h2>
              {!intake.length ? (
                <p>
                  {ui(
                    "No connected partners are accepting applications here yet. Use the official links in Opportunities, or ask the owner to invite an employer.",
                  )}
                </p>
              ) : (
                <form
                  className="profile-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      const r = await apiCall("/api/submissions", {
                        action: "submit",
                        studentId: fac ? studentId : state.access.subjectId,
                        opportunityId: applyId,
                        message: applicationMessage,
                        consent,
                      });
                      toast.success(`Application received. Receipt: ${r.id}`);
                      setApplicationMessage("");
                      setConsent(false);
                      await refresh();
                    });
                  }}
                >
                  {fac && (
                    <label>
                      {ui("Learner")}
                      <select
                        value={studentId}
                        required
                        onChange={(e) => setStudentId(e.target.value)}
                      >
                        <option value="">{ui("Choose learner")}</option>
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.data.profile.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    {ui("Opportunity")}
                    <select
                      value={applyId}
                      required
                      onChange={(e) => setApplyId(e.target.value)}
                    >
                      <option value="">{ui("Choose opportunity")}</option>
                      {intake.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.data.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {ui("Application message")}
                    <textarea
                      value={applicationMessage}
                      maxLength={3000}
                      required
                      onChange={(e) => setApplicationMessage(e.target.value)}
                    />
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={consent}
                      required
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    {ui(
                      "I agree to share this learner's name, education, district, interests and this message with the receiving partner and centre facilitators.",
                    )}
                  </label>
                  <button className="button" disabled={busy || !app.online}>
                    {ui("Submit application")}
                  </button>
                </form>
              )}
            </section>
          )}
          <section className="panel community-panel">
            <h2>{ui("Submission receipts & decisions")}</h2>
            {!submissions.length && (
              <p className="subtle">
                {ui(
                  "No applications submitted here yet. External checklist status stays in your passport.",
                )}
              </p>
            )}
            {submissions.map((s) => (
              <article className="session-card" key={s.id}>
                <span className="tag">{ui(s.status)}</span>
                <h3>{s.snapshot.opportunity}</h3>
                <p>
                  {s.snapshot.name} · {s.snapshot.education} ·{" "}
                  {s.snapshot.district}
                </p>
                <p>{s.snapshot.message}</p>
                <small>
                  {ui("Receipt:")}
                  {s.id} · {new Date(s.created_at).toLocaleString()}
                </small>
                {s.response && (
                  <p>
                    <strong>{ui("Partner response:")}</strong> {s.response}
                  </p>
                )}
                {!["Rejected", "Withdrawn"].includes(s.status) && (
                  <>
                    {(fac || role === "employer") && (
                      <>
                        <label>
                          {ui("Response")}
                          <textarea
                            maxLength={2000}
                            value={review[s.id] || ""}
                            onChange={(e) =>
                              setReview({ ...review, [s.id]: e.target.value })
                            }
                          />
                        </label>
                        <div className="button-row">
                          {["Under review", "Accepted", "Rejected"].map(
                            (status) => (
                              <button
                                key={status}
                                className="button secondary small"
                                disabled={busy}
                                onClick={() =>
                                  void run(async () => {
                                    await apiCall("/api/submissions", {
                                      action: "review",
                                      id: s.id,
                                      status,
                                      response: review[s.id] || "",
                                    });
                                    await refresh();
                                  })
                                }
                              >
                                {status}
                              </button>
                            ),
                          )}
                        </div>
                      </>
                    )}
                    {(fac || role === "student") && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await apiCall("/api/submissions", {
                              action: "review",
                              id: s.id,
                              status: "Withdrawn",
                              response: "Withdrawn by learner or facilitator",
                            });
                            await refresh();
                          })
                        }
                      >
                        {ui("Withdraw application")}
                      </button>
                    )}
                  </>
                )}
              </article>
            ))}
          </section>
        </div>
      )}
      {tab === "Payments" && <BillingPanel app={app} />}
      {tab === "Integrations" && role === "owner" && (
        <IntegrationPanel app={app} />
      )}
      {partnerOpen && (
        <PartnerDialog
          opportunityOnly
          onClose={() => setPartnerOpen(false)}
          onSave={async (kind, value) => {
            await app.save(kind, value.id, value);
            await app.sync(true);
            setPartnerOpen(false);
            await app.initialize();
            await refresh();
          }}
        />
      )}
    </div>
  );
}

export function BillingPanel({ app, course }: { app: App; course?: Course }) {
  const ui = useUiText();

  const [data, setData] = useState<any>({ payments: [], entitlements: [] });
  const [error, setError] = useState("");
  const { busy, run } = useAction();
  const refresh = async () => {
    try {
      setData(await apiCall("/api/billing"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void refresh();
  }, [app.state?.workspace.id]);
  async function checkout(productId: string) {
    const p = await apiCall("/api/billing", { action: "checkout", productId });
    window.location.assign(p.url);
  }
  return (
    <section className="panel community-panel">
      <h2>
        <CreditCard size={20} />
        {ui("Learning access")}
      </h2>
      {error && <p className="notice">{error}</p>}
      {!data.configured ? (
        <p className="notice neutral">
          {ui(
            "Payment collection awaits the centre's Razorpay configuration. Free lessons remain available. No money can be collected here yet.",
          )}
        </p>
      ) : (
        <p>
          {data.testMode
            ? "Razorpay test mode: payments do not move real money."
            : "Razorpay checkout processes payments in INR. Review the provider's checkout before paying."}
        </p>
      )}
      {course && (
        <div className="session-card">
          <h3>{course.title}</h3>
          <p>
            ₹{course.price}
            {ui("· One-time module access")}
          </p>
          <button
            className="button"
            disabled={busy || !data.configured || !app.online}
            onClick={() => void run(() => checkout(`course_${course.id}`))}
          >
            {ui("Continue to checkout")}
          </button>
        </div>
      )}
      <div className="session-card">
        <h3>{ui("Centre learning pass")}</h3>
        <p>
          {ui(
            "₹199 for 30 days of access to published paid modules in this centre. Manual renewal.",
          )}
        </p>
        <button
          className="button secondary"
          disabled={busy || !data.configured || !app.online}
          onClick={() => void run(() => checkout("centre_month"))}
        >
          {ui("Get 30-day pass")}
        </button>
      </div>
      {data.subscriptionConfigured && (
        <div className="session-card">
          <h3>{ui("Monthly subscription")}</h3>
          <p>
            {ui(
              "Renews monthly for up to 12 billing cycles. The provider shows your centre's configured plan price before authorisation. Cancel future renewals here.",
            )}
          </p>
          <button
            className="button secondary"
            disabled={busy || !data.configured || !app.online}
            onClick={() => void run(() => checkout("centre_subscription"))}
          >
            {ui("Review monthly subscription")}
          </button>
        </div>
      )}
      <h3>{ui("Payments & reconciliation")}</h3>
      <p className="subtle">
        {ui(
          "After returning from checkout, select Check payment. Access is granted only after server verification with Razorpay. Private site access may block unattended provider webhooks.",
        )}
      </p>
      {data.payments.map((p: any) => (
        <div className="payment-row" key={p.id}>
          <div>
            <strong>{p.productId}</strong>
            <small>
              ₹{(p.amount / 100).toFixed(2)} · {ui(p.status)}
            </small>
          </div>
          <div className="button-row">
            <button
              className="button secondary small"
              disabled={busy || !app.online || p.status === "failed"}
              onClick={() =>
                void run(async () => {
                  const result = await apiCall("/api/billing", {
                    action: "reconcile",
                    id: p.id,
                  });
                  toast.info(`Provider status: ${result.status}`);
                  await refresh();
                  await app.initialize();
                })
              }
            >
              {ui("Check payment")}
            </button>
            {p.productId === "centre_subscription" &&
              p.status !== "cancelled" && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await apiCall("/api/billing", {
                        action: "cancel-subscription",
                        id: p.id,
                      });
                      toast.success(
                        "Cancellation requested for the end of the billing cycle.",
                      );
                      await refresh();
                    })
                  }
                >
                  {ui("Cancel renewal")}
                </button>
              )}
          </div>
        </div>
      ))}
      {data.entitlements.map((e: any) => (
        <p className="subtle" key={e.productId + e.expiresAt}>
          {e.productId}
          {ui("· access through")} {new Date(e.expiresAt).toLocaleDateString()}
        </p>
      ))}
    </section>
  );
}
function IntegrationPanel({ app }: { app: App }) {
  const ui = useUiText();

  const { busy, run } = useAction();
  const [result, setResult] = useState("");
  const [importText, setImportText] = useState("");
  const cfg = app.state!.integrations;
  return (
    <div className="community-stack">
      <section className="panel community-panel">
        <h2>{ui("Integration readiness")}</h2>
        <div className="simple-row">
          <strong>{ui("Guidance")}</strong>
          <span>
            {cfg.ai === "retrieval"
              ? "Catalogue retrieval · hosted model not configured"
              : cfg.ai}
          </span>
        </div>
        <div className="simple-row">
          <strong>{ui("Razorpay")}</strong>
          <span>
            {cfg.payments
              ? "Configured · verify test/live mode in Payments"
              : "Awaiting provider credentials"}
          </span>
        </div>
        <div className="simple-row">
          <strong>{ui("Partner feed")}</strong>
          <span>
            {cfg.partnerFeed ? "Configured" : "Manual import available"}
          </span>
        </div>
        <p className="subtle">
          {ui(
            "Server credentials belong in the hosting secret store. See INTEGRATIONS.md in the source for exact configuration, provider links and activation tests.",
          )}
        </p>
      </section>
      <section className="panel community-panel">
        <h2>{ui("Refresh opportunity information")}</h2>
        <p>
          {ui(
            "Recheck official directory availability and import a configured partner JSON feed. A successful source check confirms reachability; provider eligibility and vacancies still need verification.",
          )}
        </p>
        <button
          className="button secondary"
          disabled={busy || !app.online}
          onClick={() =>
            void run(async () => {
              const r = await apiCall("/api/opportunity-feed", {
                action: "refresh",
              });
              setResult(r.message);
              await app.initialize();
            })
          }
        >
          {ui("Check sources & refresh feed")}
        </button>
        {result && <p role="status">{result}</p>}
      </section>
      <section className="panel community-panel">
        <h2>{ui("Import partner opportunities")}</h2>
        <p>
          {ui(
            "Paste an authorised provider export as a JSON array. Imports retain source, provider and freshness information. Imported external listings use the provider's application page.",
          )}
        </p>
        <form
          className="profile-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              let items;
              try {
                items = JSON.parse(importText);
              } catch {
                throw new Error("Paste a valid JSON array.");
              }
              const r = await apiCall("/api/opportunity-feed", {
                action: "import",
                items,
              });
              setResult(r.message);
              setImportText("");
              await app.initialize();
            });
          }}
        >
          <label>
            {ui("Provider JSON")}
            <textarea
              rows={8}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              maxLength={200000}
              placeholder={ui(
                '[{"id":"provider-course-1","title":"...","provider":"...","type":"Training","description":"...","source":"https://provider.example/course","location":"...","verifiedAt":"2026-10-17","deadline":null}]',
              )}
              required
            />
          </label>
          <button className="button" disabled={busy || !app.online}>
            {ui("Validate & import")}
          </button>
        </form>
      </section>
    </div>
  );
}
