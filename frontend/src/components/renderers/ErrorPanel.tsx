type ErrorPanelProps = {
  readonly message: string;
};

export function ErrorPanel({ message }: ErrorPanelProps) {
  return (
    <section className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800">
      <h2 className="text-sm font-semibold uppercase tracking-wide">Request Error</h2>
      <p className="mt-2 text-sm">{message}</p>
    </section>
  );
}
