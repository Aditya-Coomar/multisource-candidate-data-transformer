import { getConfidenceText, getConfidenceTone } from "@/lib/json";
import type { JsonValue } from "@/types/json";

type ConfidenceBadgeProps = {
  readonly value: JsonValue | undefined;
};

const toneClass = {
  high: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-rose-200 bg-rose-50 text-rose-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
};

export function ConfidenceBadge({ value }: ConfidenceBadgeProps) {
  const text = getConfidenceText(value);
  const tone = getConfidenceTone(value);

  return (
    <span
      className={`inline-flex h-7 items-center rounded-full border px-3 text-xs font-semibold ${toneClass[tone]}`}
    >
      {text ?? "n/a"}
    </span>
  );
}
