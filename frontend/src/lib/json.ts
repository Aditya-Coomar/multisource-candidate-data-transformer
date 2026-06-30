import type { JsonObject, JsonValue } from "@/types/json";

export function isJsonObject(value: JsonValue | unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isPrimitiveArray(value: readonly JsonValue[]): boolean {
  return value.every((item) => !isJsonObject(item) && !Array.isArray(item));
}

export function formatFieldLabel(key: string): string {
  return key
    .replace(/\[\]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function normalizeKey(key: string): string {
  return key.replace(/[_\-\s]/g, "").toLowerCase();
}

export function formatPrimitive(value: string | number | boolean | null): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

export function getObjectValue(
  object: JsonObject,
  keys: readonly string[],
): JsonValue | undefined {
  const normalized = new Map(
    Object.keys(object).map((key) => [normalizeKey(key), key]),
  );

  for (const key of keys) {
    const actualKey = normalized.get(normalizeKey(key));
    if (actualKey) {
      return object[actualKey];
    }
  }

  return undefined;
}

export function getObjectEntry(
  object: JsonObject,
  keys: readonly string[],
): readonly [string, JsonValue] | undefined {
  const normalized = new Map(
    Object.keys(object).map((key) => [normalizeKey(key), key]),
  );

  for (const key of keys) {
    const actualKey = normalized.get(normalizeKey(key));
    if (actualKey) {
      return [actualKey, object[actualKey]];
    }
  }

  return undefined;
}

export function getConfidenceTone(value: JsonValue | undefined): "low" | "medium" | "high" | "neutral" {
  if (typeof value !== "number") {
    return "neutral";
  }

  const normalized = value > 1 ? value / 100 : value;

  if (normalized >= 0.8) {
    return "high";
  }

  if (normalized >= 0.55) {
    return "medium";
  }

  return "low";
}

export function getConfidenceText(value: JsonValue | undefined): string | undefined {
  if (typeof value !== "number") {
    return undefined;
  }

  const normalized = value > 1 ? value : value * 100;
  return `${Math.round(normalized)}%`;
}
