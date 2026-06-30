import { parse as parseCsv } from 'csv-parse/sync';
import { EmptyInputError, MalformedInputError, ParserError } from '../errors';
import type { ParsedCsvContent, IngestionSource } from '../extractors/base/extractor.types';
import type { Parser } from './parser.interface';

export class CsvParser implements Parser<ParsedCsvContent> {
  public readonly name = 'CsvParser';

  supports(source: IngestionSource): boolean {
    return (
      source.mimeType === 'text/csv' ||
      source.fileName.toLowerCase().endsWith('.csv')
    );
  }

  async parse(source: IngestionSource): Promise<ParsedCsvContent> {
    const text = source.buffer.toString('utf8').trim();

    if (!text) {
      throw new EmptyInputError('CSV source is empty.', {
        source: source.fileName,
      });
    }

    try {
      const rows = parseCsv(text, {
        bom: true,
        skip_empty_lines: true,
      }) as string[][];

      if (rows.length === 0) {
        throw new EmptyInputError('CSV source is empty.', {
          source: source.fileName,
        });
      }

      const [headerRow, ...dataRows] = rows;
      const headers = headerRow.map((header) => header.trim());

      if (headers.length === 0 || headers.some((header) => !header)) {
        throw new MalformedInputError('CSV headers are missing or invalid.', {
          source: source.fileName,
        });
      }

      const duplicateHeaders = headers.filter(
        (header, index) => headers.indexOf(header) !== index,
      );

      if (duplicateHeaders.length > 0) {
        throw new MalformedInputError('CSV contains duplicate headers.', {
          source: source.fileName,
          details: {
            duplicateHeaders,
          },
        });
      }

      const normalizedRows = dataRows.map((row) =>
        headers.reduce<Record<string, string>>((accumulator, header, index) => {
          accumulator[header] = (row[index] ?? '').trim();
          return accumulator;
        }, {}),
      );

      return {
        kind: 'csv',
        headers,
        rows: normalizedRows,
        rowCount: normalizedRows.length,
      };
    } catch (error) {
      if (
        error instanceof EmptyInputError ||
        error instanceof MalformedInputError
      ) {
        throw error;
      }

      throw new ParserError('Failed to parse CSV source.', {
        source: source.fileName,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
}
