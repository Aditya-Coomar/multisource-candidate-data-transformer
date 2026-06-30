"use client";

import { SAMPLE_PROJECTION_CONFIG } from "@/lib/defaultProjectionConfig";

type ProjectionConfigEditorProps = {
  readonly value: string;
  readonly onChange: (value: string) => void;
};

export function ProjectionConfigEditor({
  value,
  onChange,
}: ProjectionConfigEditorProps) {
  const trimmed = value.trim();
  const status = getStatus(trimmed);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Projection Config
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Empty or invalid input falls back to the default schema.
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}>
          {status.label}
        </span>
      </div>

      <textarea
        className="min-h-64 w-full resize-y rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-sm text-slate-100 outline-none ring-0 transition placeholder:text-slate-500 focus:border-sky-400 focus:bg-slate-900"
        onChange={(event) => onChange(event.target.value)}
        placeholder="{ }"
        spellCheck={false}
        value={value}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          onClick={() => onChange(SAMPLE_PROJECTION_CONFIG)}
          type="button"
        >
          Load Sample
        </button>
        <button
          className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          onClick={() => onChange("")}
          type="button"
        >
          Clear
        </button>
      </div>
    </section>
  );
}

function getStatus(value: string): { readonly label: string; readonly className: string } {
  if (!value) {
    return {
      label: "Default",
      className: "border-slate-200 bg-slate-50 text-slate-600",
    };
  }

  try {
    JSON.parse(value);
    return {
      label: "Valid JSON",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  } catch {
    return {
      label: "Backend fallback",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
}
