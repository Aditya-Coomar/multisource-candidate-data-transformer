import { formatFieldLabel } from "@/lib/json";
import type { TransformSummary } from "@/types/api";

type SummaryStripProps = {
  readonly summary: TransformSummary;
  readonly requestId: string;
  readonly duration: number;
};

export function SummaryStrip({ summary, requestId, duration }: SummaryStripProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Run Summary
        </h2>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {duration} ms
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {Object.entries(summary).map(([key, value]) => (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={key}>
            <div className="text-2xl font-semibold text-slate-950">{value}</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {formatFieldLabel(key)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 truncate font-mono text-xs text-slate-500">
        requestId: {requestId}
      </div>
    </section>
  );
}
