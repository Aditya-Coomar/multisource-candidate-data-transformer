import mammoth from 'mammoth';
import { EmptyInputError, MalformedInputError, ParserError } from '../errors';
import type { IngestionSource, ParsedTextContent } from '../extractors/base/extractor.types';
import type { Parser } from './parser.interface';

export class DocxParser implements Parser<ParsedTextContent> {
  public readonly name = 'DocxParser';

  supports(source: IngestionSource): boolean {
    return (
      source.mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      source.fileName.toLowerCase().endsWith('.docx')
    );
  }

  async parse(source: IngestionSource): Promise<ParsedTextContent> {
    if (source.buffer.length === 0) {
      throw new EmptyInputError('DOCX source is empty.', {
        source: source.fileName,
      });
    }

    try {
      const result = await mammoth.extractRawText({
        buffer: source.buffer,
      });
      const text = result.value.trim();

      if (!text) {
        throw new EmptyInputError('DOCX source has no extractable text.', {
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

      if (error instanceof Error && error.message.toLowerCase().includes('zip')) {
        throw new MalformedInputError('DOCX source is malformed.', {
          source: source.fileName,
          cause: error,
        });
      }

      throw new ParserError('Failed to parse DOCX source.', {
        source: source.fileName,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
}
