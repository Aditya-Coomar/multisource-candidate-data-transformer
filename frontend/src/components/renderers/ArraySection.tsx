import { formatFieldLabel, formatPrimitive, isJsonObject, isPrimitiveArray } from "@/lib/json";
import type { JsonPrimitive, JsonValue } from "@/types/json";
import { EmptyValue } from "./EmptyValue";
import { FieldRenderer } from "./FieldRenderer";
import { ObjectSection } from "./ObjectSection";

type ArraySectionProps = {
  readonly fieldKey: string;
  readonly values: readonly JsonValue[];
  readonly compact?: boolean;
};

export function ArraySection({ fieldKey, values, compact = false }: ArraySectionProps) {
  if (values.length === 0) {
    return <EmptyValue label="Empty list" />;
  }

  if (isPrimitiveArray(values)) {
    return (
      <div className="flex flex-wrap gap-2">
        {values.map((item, index) => (
          <span
            className="inline-flex max-w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
            key={`${fieldKey}-${index}-${String(item)}`}
          >
            {formatPrimitive(item as JsonPrimitive)}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {values.map((item, index) => {
        const label = `${formatFieldLabel(fieldKey)} ${index + 1}`;

        if (isJsonObject(item)) {
          return (
            <ObjectSection
              compact={compact}
              key={`${fieldKey}-${index}`}
              title={label}
              value={item}
            />
          );
        }

        if (Array.isArray(item)) {
          return (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" key={`${fieldKey}-${index}`}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label}
              </div>
              <ArraySection fieldKey={fieldKey} values={item} compact />
            </div>
          );
        }

        return (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" key={`${fieldKey}-${index}`}>
            <FieldRenderer fieldKey={fieldKey} value={item} compact />
          </div>
        );
      })}
    </div>
  );
}
