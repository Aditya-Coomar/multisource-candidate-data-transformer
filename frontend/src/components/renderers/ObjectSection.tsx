import { sortCandidateEntries } from "@/lib/field-classifier";
import { formatFieldLabel } from "@/lib/json";
import type { JsonObject } from "@/types/json";
import { EmptyValue } from "./EmptyValue";
import { FieldRenderer } from "./FieldRenderer";

type ObjectSectionProps = {
  readonly title?: string;
  readonly value: JsonObject;
  readonly compact?: boolean;
};

export function ObjectSection({ title, value, compact = false }: ObjectSectionProps) {
  const entries = sortCandidateEntries(Object.entries(value));

  return (
    <section className={compact ? "space-y-3" : "rounded-lg border border-slate-200 bg-white p-4 shadow-sm"}>
      {title ? (
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h3>
      ) : null}
      {entries.length === 0 ? (
        <EmptyValue label="Empty object" />
      ) : (
        <div className="space-y-3">
          {entries.map(([key, item]) => (
            <div
              className="grid gap-1 border-b border-slate-100 pb-3 last:border-0 last:pb-0 sm:grid-cols-[180px_1fr]"
              key={key}
            >
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {formatFieldLabel(key)}
              </dt>
              <dd className="min-w-0">
                <FieldRenderer fieldKey={key} value={item} compact />
              </dd>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
