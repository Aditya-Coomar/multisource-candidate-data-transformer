import type { FieldResolution } from '../base/projector.types';
import type { OutputBuilder } from '../builders/output.builder';

export class FieldMapper {
  constructor(private readonly outputBuilder: OutputBuilder) {}

  map(output: Record<string, unknown>, resolution: FieldResolution): void {
    this.outputBuilder.set(output, resolution.outputPath, resolution.value);
  }
}
