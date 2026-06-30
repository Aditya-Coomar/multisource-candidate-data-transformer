import { formatFieldLabel, formatPrimitive, isJsonObject } from "@/lib/json";
import type { JsonPrimitive, JsonValue } from "@/types/json";

type JsonTreeProps = {
  readonly value: JsonValue;
  readonly label?: string;
  readonly depth?: number;
};

export function JsonTree({ value, label = "response", depth = 0 }: JsonTreeProps) {
  if (Array.isArray(value)) {
    return (
      <details className="rounded-md border border-slate-200 bg-white p-3" open={depth < 2}>
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          {formatFieldLabel(label)} <span className="text-slate-400">[{value.length}]</span>
        </summary>
        <div className="mt-3 space-y-2 border-l border-slate-200 pl-3">
          {value.map((item, index) => (
            <JsonTree
              depth={depth + 1}
              key={`${label}-${index}`}
              label={`${index}`}
              value={item}
            />
          ))}
        </div>
      </details>
    );
  }

  if (isJsonObject(value)) {
    const entries = Object.entries(value);

    return (
      <details className="rounded-md border border-slate-200 bg-white p-3" open={depth < 2}>
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          {formatFieldLabel(label)} <span className="text-slate-400">{"{}"}</span>
        </summary>
        <div className="mt-3 space-y-2 border-l border-slate-200 pl-3">
          {entries.length === 0 ? (
            <span className="text-sm text-slate-400">empty object</span>
          ) : (
            entries.map(([key, item]) => (
              <JsonTree depth={depth + 1} key={key} label={key} value={item} />
            ))
          )}
        </div>
      </details>
    );
  }

  return (
    <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-[160px_1fr]">
      <span className="text-sm font-semibold text-slate-500">
        {formatFieldLabel(label)}
      </span>
      <span className="break-words font-mono text-sm text-slate-800">
        {formatPrimitive(value as JsonPrimitive)}
      </span>
    </div>
  );
}
