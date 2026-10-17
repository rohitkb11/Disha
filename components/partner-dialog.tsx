"use client";
import { useUiText } from "./ui-language";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Modal } from "./shared";
import type { Mentor, Opportunity } from "@/lib/types";
export default function PartnerDialog({
  onClose,
  onSave,
  opportunityOnly = false,
}: {
  opportunityOnly?: boolean;
  onClose: () => void;
  onSave: (
    kind: "mentor" | "opportunity",
    value: Mentor | Opportunity,
  ) => Promise<void>;
}) {
  const ui = useUiText();

  const [kind, setKind] = useState<"mentor" | "opportunity">(
    opportunityOnly ? "opportunity" : "mentor",
  );
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<Opportunity["type"]>("Training");
  const [location, setLocation] = useState("");
  const [languages, setLanguages] = useState("English, Hindi");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={ui("Add your community network")} onClose={onClose}>
      <form
        className="profile-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const id = crypto.randomUUID();
            if (kind === "mentor")
              await onSave(kind, {
                id,
                name,
                organization,
                title,
                bio: description,
                languages: languages
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .slice(0, 10),
                expertise: [title],
                initials: name
                  .split(" ")
                  .map((s) => s[0])
                  .join("")
                  .slice(0, 2),
                color: "mint",
                sample: false,
              });
            else
              await onSave(kind, {
                id,
                title,
                provider: organization,
                description,
                type,
                benefit: "Check partner-provided terms",
                location,
                source: url,
                sourceLabel: "Community partner link",
                verifiedAt: new Date().toISOString().slice(0, 10),
                deadline: null,
                criteria: [],
                documents: [
                  "Verify current provider requirements",
                  "Review costs and prerequisites",
                  "Prepare provider-required information",
                ],
                sample: false,
                color: "peach",
                interests: [],
              });
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {ui("Record type")}
          <select
            value={kind}
            onChange={(e) =>
              setKind(e.target.value as "mentor" | "opportunity")
            }
          >
            {!opportunityOnly && (
              <option value="mentor">{ui("Community mentor")}</option>
            )}
            <option value="opportunity">
              {ui("NGO / employer / training opportunity")}
            </option>
          </select>
        </label>
        {kind === "mentor" && (
          <label>
            {ui("Mentor name")}
            <input
              value={name}
              maxLength={100}
              required
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        <label>
          {ui("Organization / provider")}
          <input
            required
            maxLength={150}
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
          />
        </label>
        <label>
          {kind === "mentor"
            ? "Expertise / professional role"
            : "Opportunity title"}
          <input
            required
            maxLength={180}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          {ui("Description")}
          <textarea
            required
            maxLength={3000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {kind === "mentor" ? (
          <label>
            {ui("Languages (separate with commas)")}
            <input
              required
              value={languages}
              maxLength={200}
              onChange={(e) => setLanguages(e.target.value)}
            />
          </label>
        ) : (
          <>
            <div className="form-grid">
              <label>
                {ui("Type")}
                <select
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as Opportunity["type"])
                  }
                >
                  {[
                    "Training",
                    "Scholarship",
                    "Apprenticeship",
                    "Mentorship",
                    "Experience",
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                {ui("Location")}
                <input
                  required
                  value={location}
                  maxLength={150}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </label>
            </div>
            <label>
              {ui("Official provider page (https://)")}
              <input
                type="url"
                pattern="https://.*"
                required
                value={url}
                maxLength={1000}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
          </>
        )}
        <p className="notice neutral">
          {ui(
            "This saves a facilitator-provided record in your private workspace. Confirm the person's consent and provider details before arranging real participation. No invitation or message is sent.",
          )}
        </p>
        <div className="modal-actions">
          <button className="button" disabled={busy} type="submit">
            {ui("Save community record")}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
