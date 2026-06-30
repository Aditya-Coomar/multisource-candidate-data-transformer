import pdfParse from 'pdf-parse';
import { EmptyInputError, MalformedInputError, ParserError } from '../errors';
import type { IngestionSource, ParsedTextContent } from '../extractors/base/extractor.types';
import type { Parser } from './parser.interface';

type PdfParseResult = {
  text: string;
};

type PdfParseFunction = (input: Buffer) => Promise<PdfParseResult>;

export class PdfParser implements Parser<ParsedTextContent> {
  public readonly name = 'PdfParser';

  supports(source: IngestionSource): boolean {
    return (
      source.mimeType === 'application/pdf' ||
      source.fileName.toLowerCase().endsWith('.pdf')
    );
  }

  async parse(source: IngestionSource): Promise<ParsedTextContent> {
    if (source.buffer.length === 0) {
      throw new EmptyInputError('PDF source is empty.', {
        source: source.fileName,
      });
    }

    try {
      const parsePdf = pdfParse as unknown as PdfParseFunction;
      const result = await parsePdf(source.buffer);
      const text = result.text.trim();

      if (!text) {
        throw new EmptyInputError('PDF source has no extractable text.', {
          source: source.fileName,
        });
      }

      return {
        kind: 'text',
        text,
      };
    } catch (error) {
      if (error instanceof EmptyInputError) {
        throw error;
      }

      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('password') || message.includes('encrypted')) {
        throw new MalformedInputError('Encrypted PDF is not supported.', {
          source: source.fileName,
          cause: error instanceof Error ? error : undefined,
        });
      }

      if (message.includes('invalid') || message.includes('bad xref')) {
        throw new MalformedInputError('PDF source is malformed.', {
          source: source.fileName,
          cause: error instanceof Error ? error : undefined,
        });
      }

      throw new ParserError('Failed to parse PDF source.', {
        source: source.fileName,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
}
