import { UnsupportedSourceError } from '../../errors';
import { AtsJsonExtractor } from '../structured/ats-json.extractor';
import { CsvExtractor } from '../structured/csv.extractor';
import { RecruiterNotesExtractor } from '../unstructured/recruiter-notes.extractor';
import { ResumeExtractor } from '../unstructured/resume.extractor';
import type { Extractor } from './extractor.interface';
import { ExtractorRegistry } from './extractor.registry';
import type { IngestionSource, ParsedContent } from './extractor.types';

export class ExtractorFactory {
  private readonly registry: ExtractorRegistry;

  constructor(registry?: ExtractorRegistry) {
    this.registry = registry ?? new ExtractorRegistry();

    if (this.registry.list().length === 0) {
      this.registry.register(new CsvExtractor());
      this.registry.register(new AtsJsonExtractor());
      this.registry.register(new ResumeExtractor());
      this.registry.register(new RecruiterNotesExtractor());
    }
  }

  resolve(source: IngestionSource, parsedContent: ParsedContent): Extractor {
    const extractor = this.registry.resolve(source, parsedContent);

    if (!extractor) {
      throw new UnsupportedSourceError('No extractor registered for source.', {
        source: source.fileName,
        details: {
          mimeType: source.mimeType,
          sourceType: source.sourceType,
          parsedKind: parsedContent.kind,
        },
      });
    }

    return extractor;
  }

  getRegistry(): ExtractorRegistry {
    return this.registry;
  }
}
