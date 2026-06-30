import logger from '../../logger';
import { EmptyInputError, MalformedInputError, UnsupportedSourceError } from '../../errors';
import { createPartialCandidate } from '../../models/partial-candidate';
import { createSourceRecord } from '../../models/source-record';
import { ExtractorFactory } from '../../extractors/base/extractor.factory';
import type { IngestionSource } from '../../extractors/base/extractor.types';
import type { PartialCandidate } from '../../models/partial-candidate';
import { ParserFactory } from '../../parsers/parser.factory';

const BLOCKED_EXTENSIONS = new Set([
  '.exe',
  '.dll',
  '.bat',
  '.cmd',
  '.com',
  '.msi',
  '.zip',
  '.rar',
  '.7z',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.mp4',
]);

const BLOCKED_MIME_TYPES = new Set([
  'application/x-msdownload',
  'application/zip',
  'application/x-rar-compressed',
  'video/mp4',
  'image/png',
  'image/jpeg',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set(['.csv', '.json', '.pdf', '.docx', '.txt']);

function getFileExtension(fileName: string): string {
  const normalized = fileName.toLowerCase();
  const lastDotIndex = normalized.lastIndexOf('.');
  return lastDotIndex >= 0 ? normalized.slice(lastDotIndex) : '';
}

export class ExtractStage {
  private readonly parserFactory: ParserFactory;
  private readonly extractorFactory: ExtractorFactory;

  constructor(
    parserFactory = new ParserFactory(),
    extractorFactory = new ExtractorFactory(),
  ) {
    this.parserFactory = parserFactory;
    this.extractorFactory = extractorFactory;
  }

  async execute(sources: readonly IngestionSource[]): Promise<readonly PartialCandidate[]> {
    const partialCandidates: PartialCandidate[] = [];

    for (const source of sources) {
      this.validateSource(source);

      logger.info('extraction.started', {
        sourceId: source.sourceId,
        sourceType: source.sourceType,
        fileName: source.fileName,
        size: source.size,
      });

      const parser = this.parserFactory.resolve(source);
      logger.debug('extraction.parser.selected', {
        sourceId: source.sourceId,
        parser: parser.name,
      });

      const parsedContent = await parser.parse(source);
      const extractor = this.extractorFactory.resolve(source, parsedContent);
      logger.debug('extraction.extractor.selected', {
        sourceId: source.sourceId,
        extractor: extractor.name,
      });

      const extractedCandidates = await extractor.extract(parsedContent);
      logger.debug('extraction.fields.extracted', {
        sourceId: source.sourceId,
        candidateCount: extractedCandidates.length,
      });

      const sourceRecord = createSourceRecord({
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        sourceType: source.sourceType,
        fileName: source.fileName,
        mimeType: source.mimeType,
        receivedAt: source.receivedAt,
        parser: parser.name,
        extractor: extractor.name,
        metadata: {
          size: source.size,
        },
      });

      partialCandidates.push(
        ...extractedCandidates.map((candidate) =>
          createPartialCandidate({
            ...candidate,
            sourceRecords: [sourceRecord],
          }),
        ),
      );

      logger.info('extraction.finished', {
        sourceId: source.sourceId,
        sourceType: source.sourceType,
        parser: parser.name,
        extractor: extractor.name,
        candidateCount: extractedCandidates.length,
      });
    }

    return partialCandidates;
  }

  private validateSource(source: IngestionSource): void {
    if (source.size === 0 || source.buffer.length === 0) {
      throw new EmptyInputError('Source payload is empty.', {
        source: source.fileName,
      });
    }

    if (source.size > MAX_FILE_SIZE_BYTES) {
      throw new MalformedInputError('Source payload exceeds maximum size.', {
        source: source.fileName,
        details: {
          maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
          size: source.size,
        },
      });
    }

    const extension = getFileExtension(source.fileName);
    if (BLOCKED_EXTENSIONS.has(extension) || BLOCKED_MIME_TYPES.has(source.mimeType)) {
      throw new UnsupportedSourceError('Source format is not supported.', {
        source: source.fileName,
        details: {
          extension,
          mimeType: source.mimeType,
        },
      });
    }

    if (!extension) {
      throw new UnsupportedSourceError('Source file extension is missing.', {
        source: source.fileName,
      });
    }

    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      throw new UnsupportedSourceError('Source file extension is not supported.', {
        source: source.fileName,
        details: {
          extension,
        },
      });
    }

    if (source.fileName.toLowerCase().match(/\.(pdf|docx|csv|json|txt)\./)) {
      throw new UnsupportedSourceError('Hidden file extensions are not supported.', {
        source: source.fileName,
      });
    }
  }
}
