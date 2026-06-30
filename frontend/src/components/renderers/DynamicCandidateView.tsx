import { classifyField, type FieldGroup } from "@/lib/field-classifier";
import {
  formatFieldLabel,
  getObjectEntry,
  getObjectValue,
  isJsonObject,
} from "@/lib/json";
import type { JsonObject, JsonValue } from "@/types/json";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { EmptyValue } from "./EmptyValue";
import { FieldRenderer } from "./FieldRenderer";

type DynamicCandidateViewProps = {
  readonly candidate: JsonObject;
};

const SECTIONS: readonly { readonly group: FieldGroup; readonly title: string }[] = [
  { group: "identity", title: "Identity" },
  { group: "contact", title: "Contact" },
  { group: "skills", title: "Skills" },
  { group: "experience", title: "Experience" },
  { group: "education", title: "Education" },
  { group: "provenance", title: "Provenance" },
  { group: "diagnostics", title: "Confidence And Diagnostics" },
  { group: "other", title: "Additional Fields" },
];

export function DynamicCandidateView({ candidate }: DynamicCandidateViewProps) {
  const grouped = groupEntries(candidate);
  const name = getDisplayName(candidate);
  const headline = getDisplayHeadline(candidate);
  const confidence = getObjectValue(candidate, [
    "overall_confidence",
    "overallConfidence",
    "confidence",
  ]);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Candidate
            </div>
            <h2 className="mt-1 break-words text-2xl font-semibold text-slate-950">
              {name}
            </h2>
            {headline ? (
              <p className="mt-2 break-words text-sm text-slate-600">{headline}</p>
            ) : null}
          </div>
          <div className="shrink-0">
            <ConfidenceBadge value={confidence} />
          </div>
        </div>
      </section>

      {SECTIONS.map(({ group, title }) => {
        const entries = grouped[group] ?? [];

        if (entries.length === 0) {
          return null;
        }

        return (
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={group}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {title}
            </h3>
            <div className="space-y-3">
              {entries.map(([key, value]) => (
                <div
                  className="grid gap-1 border-b border-slate-100 pb-3 last:border-0 last:pb-0 lg:grid-cols-[190px_1fr]"
                  key={key}
                >
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {formatFieldLabel(key)}
                  </dt>
                  <dd className="min-w-0">
                    <FieldRenderer fieldKey={key} value={value} compact />
                  </dd>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {Object.keys(candidate).length === 0 ? <EmptyValue label="Empty candidate" /> : null}
    </div>
  );
}

function groupEntries(candidate: JsonObject): Record<FieldGroup, [string, JsonValue][]> {
  const grouped: Record<FieldGroup, [string, JsonValue][]> = {
    identity: [],
    contact: [],
    skills: [],
    experience: [],
    education: [],
    provenance: [],
    diagnostics: [],
    other: [],
  };

  for (const [key, value] of Object.entries(candidate)) {
    grouped[classifyField(key)].push([key, value]);
  }

  return grouped;
}

function getDisplayName(candidate: JsonObject): string {
  const entry = getObjectEntry(candidate, [
    "full_name",
    "fullName",
    "candidate_name",
    "candidateName",
    "name",
  ]);

  return typeof entry?.[1] === "string" && entry[1].trim()
    ? entry[1]
    : "Unnamed Candidate";
}

function getDisplayHeadline(candidate: JsonObject): string | undefined {
  const headline = getObjectValue(candidate, ["headline", "title", "current_title"]);

  if (typeof headline === "string" && headline.trim()) {
    return headline;
  }

  const location = getObjectValue(candidate, ["location"]);
  if (isJsonObject(location)) {
    const formatted = location.formatted ?? location.raw;
    return typeof formatted === "string" ? formatted : undefined;
  }

  return undefined;
}
