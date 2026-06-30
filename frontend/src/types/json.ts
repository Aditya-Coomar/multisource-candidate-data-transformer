export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | readonly JsonValue[] | JsonObject;

export type JsonObject = {
  readonly [key: string]: JsonValue;
};
