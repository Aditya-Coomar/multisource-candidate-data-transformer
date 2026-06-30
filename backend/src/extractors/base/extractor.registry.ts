import type { Extractor } from './extractor.interface';
import type { IngestionSource, ParsedContent } from './extractor.types';

export class ExtractorRegistry {
  private readonly extractors: Extractor[] = [];

  register(extractor: Extractor): void {
    this.extractors.push(extractor);
  }

  resolve(source: IngestionSource, parsedContent: ParsedContent): Extractor | undefined {
    return this.extractors.find((extractor) =>
      extractor.supports(source, parsedContent),
    );
  }

  list(): readonly Extractor[] {
    return this.extractors;
  }
}
