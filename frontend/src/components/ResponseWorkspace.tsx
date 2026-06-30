"use client";

import { useMemo, useState } from "react";
import { CandidateTabs } from "./CandidateTabs";
import { SummaryStrip } from "./SummaryStrip";
import { DynamicCandidateView } from "./renderers/DynamicCandidateView";
import { ErrorPanel } from "./renderers/ErrorPanel";
import { JsonTree } from "./renderers/JsonTree";
import type { TransformResponse } from "@/types/api";
import type { JsonObject } from "@/types/json";

type ResponseWorkspaceProps = {
  readonly response: TransformResponse | undefined;
  readonly error: string | undefined;
  readonly isLoading: boolean;
};

type WorkspaceTab = "structured" | "raw" | "diagnostics";

const tabs: readonly { readonly id: WorkspaceTab; readonly label: string }[] = [
  { id: "structured", label: "Structured" },
  { id: "raw", label: "Raw JSON" },
  { id: "diagnostics", label: "Diagnostics" },
];

export function ResponseWorkspace({
  response,
  error,
  isLoading,
}: ResponseWorkspaceProps) {
  const [tab, setTab] = useState<WorkspaceTab>("structured");
  const [activeCandidate, setActiveCandidate] = useState(0);
  const candidates = response?.data.candidates ?? [];
  const selectedCandidate = candidates[activeCandidate] ?? candidates[0];
  const diagnostics = useMemo<JsonObject>(
    () => ({
      semanticWarnings: response?.data.semanticWarnings ?? [],
      llmDecisions: response?.data.llmDecisions ?? [],
      explanations: response?.data.explanations ?? [],
    }),
    [response],
  );

  if (isLoading) {
    return (
      <section className="flex min-h-96 items-center justify-center rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950" />
          <p className="mt-4 text-sm font-semibold text-slate-600">
            Running pipeline
          </p>
        </div>
      </section>
    );
  }

  if (error) {
    return <ErrorPanel message={error} />;
  }

  if (!response) {
    return (
      <section className="flex min-h-96 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">No response yet</h2>
          <p className="mt-2 text-sm text-slate-500">
            Results will appear here after the transform completes.
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <SummaryStrip
        duration={response.duration}
        requestId={response.requestId}
        summary={response.data.summary}
      />

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              className={
                item.id === tab
                  ? "rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
                  : "rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              }
              key={item.id}
              onClick={() => setTab(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <CandidateTabs
          activeIndex={activeCandidate}
          candidates={candidates}
          onChange={setActiveCandidate}
        />
      </div>

      {tab === "structured" ? (
        selectedCandidate ? (
          <DynamicCandidateView candidate={selectedCandidate} />
        ) : (
          <ErrorPanel message="The response did not contain any candidates." />
        )
      ) : null}

      {tab === "raw" ? (
        <pre className="max-h-[720px] overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-xs leading-6 text-slate-100 shadow-sm">
          {JSON.stringify(response, null, 2)}
        </pre>
      ) : null}

      {tab === "diagnostics" ? <JsonTree label="diagnostics" value={diagnostics} /> : null}
    </div>
  );
}
