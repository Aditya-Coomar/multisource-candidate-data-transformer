type EmptyValueProps = {
  readonly label?: string;
};

export function EmptyValue({ label = "No value" }: EmptyValueProps) {
  return <span className="text-sm text-slate-400">{label}</span>;
}
