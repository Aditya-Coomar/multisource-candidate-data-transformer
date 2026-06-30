type UploadPanelProps = {
  readonly files: readonly File[];
  readonly onFilesChange: (files: File[]) => void;
};

export function UploadPanel({ files, onFilesChange }: UploadPanelProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Sources
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Upload resumes, notes, CSV, JSON, PDF, DOCX, or text files.
        </p>
      </div>

      <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center transition hover:border-slate-400 hover:bg-slate-100">
        <span className="text-sm font-semibold text-slate-800">Choose files</span>
        <span className="mt-1 text-xs text-slate-500">Multiple sources are supported</span>
        <input
          className="sr-only"
          multiple
          onChange={(event) => onFilesChange(Array.from(event.target.files ?? []))}
          type="file"
        />
      </label>

      {files.length > 0 ? (
        <div className="mt-4 space-y-2">
          {files.map((file) => (
            <div
              className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm"
              key={`${file.name}-${file.size}-${file.lastModified}`}
            >
              <span className="min-w-0 truncate font-medium text-slate-700">
                {file.name}
              </span>
              <span className="shrink-0 text-xs text-slate-500">
                {formatFileSize(file.size)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
