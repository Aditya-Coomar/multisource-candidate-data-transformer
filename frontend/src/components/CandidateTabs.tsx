import type { JsonObject } from "@/types/json";

type CandidateTabsProps = {
  readonly candidates: readonly JsonObject[];
  readonly activeIndex: number;
  readonly onChange: (index: number) => void;
};

export function CandidateTabs({
  candidates,
  activeIndex,
  onChange,
}: CandidateTabsProps) {
  if (candidates.length <= 1) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {candidates.map((candidate, index) => {
        const label = getCandidateLabel(candidate, index);
        const active = index === activeIndex;

        return (
          <button
            className={
              active
                ? "rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
                : "rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            }
            key={index}
            onClick={() => onChange(index)}
            type="button"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function getCandidateLabel(candidate: JsonObject, index: number): string {
  const name =
    candidate.full_name ??
    candidate.fullName ??
    candidate.candidate_name ??
    candidate.candidateName ??
    candidate.name;

  return typeof name === "string" && name.trim()
    ? name
    : `Candidate ${index + 1}`;
}
