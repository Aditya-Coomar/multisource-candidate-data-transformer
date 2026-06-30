import type { PartialCandidate } from '../../models/partial-candidate';
import type { IngestionSource, ParsedContent } from './extractor.types';

export interface Extractor<TParsedContent extends ParsedContent = ParsedContent> {
  readonly name: string;
  supports(source: IngestionSource, parsedContent: ParsedContent): boolean;
  extract(parsedContent: TParsedContent): Promise<readonly PartialCandidate[]>;
}
