import { formatFieldLabel, isJsonObject } from "@/lib/json";
import type { JsonValue } from "@/types/json";
import { EmptyValue } from "./EmptyValue";
import { FieldRenderer } from "./FieldRenderer";

type ProvenanceListProps = {
  readonly items: readonly JsonValue[];
};

export function ProvenanceList({ items }: ProvenanceListProps) {
  if (items.length === 0) {
    return <EmptyValue label="No provenance records" />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-3 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>Field</span>
        <span>Source</span>
        <span>Method</span>
      </div>
      <div className="divide-y divide-slate-100">
        {items.map((item, index) => {
          if (!isJsonObject(item)) {
            return (
              <div className="px-3 py-2" key={index}>
                <FieldRenderer fieldKey="provenance" value={item} compact />
              </div>
            );
          }

          const entries = Object.entries(item);
          const field = item.field ?? item.fieldPath ?? item.path ?? null;
          const source = item.source ?? item.sourceId ?? item.sourceName ?? null;
          const method = item.method ?? item.strategy ?? item.extractor ?? null;

          return (
            <div className="grid grid-cols-[1fr_1fr_1fr] gap-3 px-3 py-2 text-sm text-slate-700" key={index}>
              <span className="min-w-0 break-words">{String(field ?? "unknown")}</span>
              <span className="min-w-0 break-words">{String(source ?? "unknown")}</span>
              <span className="min-w-0 break-words">{String(method ?? "unknown")}</span>
              {entries.length > 3 ? (
                <details className="col-span-3 rounded-md bg-slate-50 p-2">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-500">
                    Additional Details
                  </summary>
                  <div className="mt-2 space-y-2">
                    {entries.map(([key, value]) => (
                      <div className="grid gap-1 sm:grid-cols-[160px_1fr]" key={key}>
                        <span className="text-xs font-semibold uppercase text-slate-500">
                          {formatFieldLabel(key)}
                        </span>
                        <FieldRenderer fieldKey={key} value={value} compact />
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
