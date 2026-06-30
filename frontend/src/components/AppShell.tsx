"use client";

import { useState } from "react";
import { transformCandidates } from "@/lib/api";
import type { TransformResponse } from "@/types/api";
import { ProjectionConfigEditor } from "./ProjectionConfigEditor";
import { ResponseWorkspace } from "./ResponseWorkspace";
import { TransformControls } from "./TransformControls";
import { UploadPanel } from "./UploadPanel";

export function AppShell() {
  const [files, setFiles] = useState<File[]>([]);
  const [projectionConfig, setProjectionConfig] = useState("");
  const [response, setResponse] = useState<TransformResponse>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit() {
    if (files.length === 0) {
      setError("At least one source file is required.");
      return;
    }

    setError(undefined);
    setIsLoading(true);

    try {
      const result = await transformCandidates({
        files,
        projectionConfig,
      });
      setResponse(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Transform request failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-5 lg:px-6">
        <header className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Candidate Data Transformer
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Upload sources, run the pipeline, inspect structured and raw output.
            </p>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Demo Workspace
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[410px_1fr]">
          <aside className="space-y-4">
            <UploadPanel files={files} onFilesChange={setFiles} />
            <ProjectionConfigEditor
              onChange={setProjectionConfig}
              value={projectionConfig}
            />
            <TransformControls
              disabled={files.length === 0}
              isLoading={isLoading}
              onSubmit={handleSubmit}
            />
          </aside>

          <ResponseWorkspace error={error} isLoading={isLoading} response={response} />
        </div>
      </div>
    </main>
  );
}
