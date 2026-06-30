export class OutputBuilder {
  create(): Record<string, unknown> {
    return {};
  }

  set(target: Record<string, unknown>, path: string, value: unknown): void {
    const segments = path.split('.').filter(Boolean);
    let current: Record<string, unknown> = target;

    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index]!;
      const existing = current[segment];

      if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
        current[segment] = {};
      }

      current = current[segment] as Record<string, unknown>;
    }

    current[segments[segments.length - 1]!] = value;
  }
}
