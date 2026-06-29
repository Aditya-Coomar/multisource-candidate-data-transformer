const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
]);

export function redactHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
  return Object.entries(headers).reduce<
    Record<string, string | string[] | undefined>
  >((accumulator, [key, value]) => {
    accumulator[key] = SENSITIVE_HEADERS.has(key.toLowerCase())
      ? '[REDACTED]'
      : value;

    return accumulator;
  }, {});
}
