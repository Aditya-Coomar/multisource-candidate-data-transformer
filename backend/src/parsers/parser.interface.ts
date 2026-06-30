import type { IngestionSource, ParsedContent } from '../extractors/base/extractor.types';

export interface Parser<TParsedContent extends ParsedContent = ParsedContent> {
  readonly name: string;
  supports(source: IngestionSource): boolean;
  parse(source: IngestionSource): Promise<TParsedContent>;
}
