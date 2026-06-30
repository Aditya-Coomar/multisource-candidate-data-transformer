import { UnsupportedSourceError } from '../errors';
import type { IngestionSource } from '../extractors/base/extractor.types';
import { CsvParser } from './csv.parser';
import { DocxParser } from './docx.parser';
import { JsonParser } from './json.parser';
import type { Parser } from './parser.interface';
import { PdfParser } from './pdf.parser';
import { TextParser } from './text.parser';

export class ParserFactory {
  private readonly parsers: readonly Parser[];

  constructor(parsers?: readonly Parser[]) {
    this.parsers =
      parsers ??
      [
        new CsvParser(),
        new JsonParser(),
        new PdfParser(),
        new DocxParser(),
        new TextParser(),
      ];
  }

  resolve(source: IngestionSource): Parser {
    const parser = this.parsers.find((candidate) => candidate.supports(source));

    if (!parser) {
      throw new UnsupportedSourceError('No parser registered for source.', {
        source: source.fileName,
        details: {
          mimeType: source.mimeType,
          sourceType: source.sourceType,
        },
      });
    }

    return parser;
  }
}
