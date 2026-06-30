import { getApiBaseUrl } from "@/lib/api";

type TransformControlsProps = {
  readonly disabled: boolean;
  readonly isLoading: boolean;
  readonly onSubmit: () => void;
};

export function TransformControls({
  disabled,
  isLoading,
  onSubmit,
}: TransformControlsProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Endpoint
      </div>
      <code className="block truncate rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-700">
        {getApiBaseUrl()}/api/v1/transform
      </code>
      <button
        className="mt-4 h-11 w-full rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled={disabled || isLoading}
        onClick={onSubmit}
        type="button"
      >
        {isLoading ? "Transforming..." : "Run Transform"}
      </button>
    </section>
  );
}
