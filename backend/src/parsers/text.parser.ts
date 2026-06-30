import { TextDecoder } from 'node:util';
import { EmptyInputError, ParserError } from '../errors';
import type { IngestionSource, ParsedTextContent } from '../extractors/base/extractor.types';
import type { Parser } from './parser.interface';

export class TextParser implements Parser<ParsedTextContent> {
  public readonly name = 'TextParser';

  supports(source: IngestionSource): boolean {
    return (
      source.mimeType.startsWith('text/') ||
      source.fileName.toLowerCase().endsWith('.txt')
    );
  }

  async parse(source: IngestionSource): Promise<ParsedTextContent> {
    if (source.buffer.length === 0) {
      throw new EmptyInputError('Text source is empty.', {
        source: source.fileName,
      });
    }

    try {
      const buffer = source.buffer;
      const isUtf16 =
        buffer.length >= 2 &&
        ((buffer[0] === 0xff && buffer[1] === 0xfe) ||
          (buffer[0] === 0xfe && buffer[1] === 0xff) ||
          buffer.subarray(0, 16).includes(0x00));

      const decoder = new TextDecoder(isUtf16 ? 'utf-16le' : 'utf-8', {
        fatal: false,
      });
      const text = decoder.decode(buffer).split('\0').join('').trim();

      if (!text) {
        throw new EmptyInputError('Text source is empty.', {
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

      throw new ParserError('Failed to parse text source.', {
        source: source.fileName,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
}
