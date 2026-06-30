import { classifyField } from "@/lib/field-classifier";
import { formatFieldLabel, isJsonObject } from "@/lib/json";
import type { JsonPrimitive, JsonValue } from "@/types/json";
import { ArraySection } from "./ArraySection";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { ObjectSection } from "./ObjectSection";
import { PrimitiveValue } from "./PrimitiveValue";
import { ProvenanceList } from "./ProvenanceList";

type FieldRendererProps = {
  readonly fieldKey: string;
  readonly value: JsonValue;
  readonly compact?: boolean;
};

export function FieldRenderer({
  fieldKey,
  value,
  compact = false,
}: FieldRendererProps) {
  const group = classifyField(fieldKey);

  if (group === "provenance" && Array.isArray(value)) {
    return <ProvenanceList items={value} />;
  }

  if (group === "diagnostics" && typeof value === "number") {
    return <ConfidenceBadge value={value} />;
  }

  if (Array.isArray(value)) {
    return <ArraySection fieldKey={fieldKey} values={value} compact={compact} />;
  }

  if (isJsonObject(value)) {
    return <ObjectSection title={formatFieldLabel(fieldKey)} value={value} compact={compact} />;
  }

  return <PrimitiveValue value={value as JsonPrimitive} />;
}
