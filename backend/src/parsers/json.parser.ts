import { EmptyInputError, MalformedInputError, ParserError } from '../errors';
import type { IngestionSource, ParsedJsonContent } from '../extractors/base/extractor.types';
import type { Parser } from './parser.interface';

export class JsonParser implements Parser<ParsedJsonContent> {
  public readonly name = 'JsonParser';

  supports(source: IngestionSource): boolean {
    return (
      source.mimeType === 'application/json' ||
      source.fileName.toLowerCase().endsWith('.json')
    );
  }

  async parse(source: IngestionSource): Promise<ParsedJsonContent> {
    const text = source.buffer.toString('utf8').trim();

    if (!text) {
      throw new EmptyInputError('JSON source is empty.', {
        source: source.fileName,
      });
    }

    try {
      return {
        kind: 'json',
        data: JSON.parse(text) as unknown,
      };
    } catch (error) {
      if (error instanceof EmptyInputError) {
        throw error;
      }

      if (error instanceof SyntaxError) {
        throw new MalformedInputError('JSON source is malformed.', {
          source: source.fileName,
          cause: error,
        });
      }

      throw new ParserError('Failed to parse JSON source.', {
        source: source.fileName,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
}
