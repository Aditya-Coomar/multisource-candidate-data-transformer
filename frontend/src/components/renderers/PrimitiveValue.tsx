import { formatPrimitive } from "@/lib/json";
import type { JsonPrimitive } from "@/types/json";

type PrimitiveValueProps = {
  readonly value: JsonPrimitive;
};

export function PrimitiveValue({ value }: PrimitiveValueProps) {
  const isNull = value === null;

  return (
    <span
      className={
        isNull
          ? "font-mono text-sm text-slate-400"
          : "break-words text-sm text-slate-800"
      }
    >
      {formatPrimitive(value)}
    </span>
  );
}
