import { z } from 'zod';
import logger from '../../logger';
import { EmptyInputError, MalformedInputError, UnsupportedSourceError } from '../../errors';
import { createPartialCandidate } from '../../models/partial-candidate';
import { createEducation } from '../../models/education';
import { createExperience } from '../../models/experience';
import { createLocation } from '../../models/location';
import { createSourceRecord } from '../../models/source-record';
import { createSkill } from '../../models/skill';
import { ExtractorFactory } from '../../extractors/base/extractor.factory';
import type {
  IngestionSource,
  ParsedContent,
  ParsedTextContent,
} from '../../extractors/base/extractor.types';
import type { PartialCandidate } from '../../models/partial-candidate';
import { ParserFactory } from '../../parsers/parser.factory';
import type { LLMRuntimeContext } from '../../llm/runtime';

const extractionRefinementSchema = z
  .object({
    headline: z.string().min(1).optional(),
    summary: z.string().min(1).optional(),
    location: z
      .object({
        raw: z.string().min(1).optional(),
        city: z.string().min(1).optional(),
        region: z.string().min(1).optional(),
        country: z.string().min(1).optional(),
        postalCode: z.string().min(1).optional(),
        formatted: z.string().min(1).optional(),
      })
      .optional(),
    skills: z.array(z.string().min(1)).default([]),
    experiences: z
      .array(
        z.object({
          employer: z.string().min(1),
          title: z.string().min(1).optional(),
          description: z.string().min(1).optional(),
          startDate: z.string().min(1).optional(),
          endDate: z.string().min(1).optional(),
          isCurrent: z.boolean().optional(),
        }),
      )
      .default([]),
    education: z
      .array(
        z.object({
          institution: z.string().min(1),
          degree: z.string().min(1).optional(),
          fieldOfStudy: z.string().min(1).optional(),
          startDate: z.string().min(1).optional(),
          endDate: z.string().min(1).optional(),
        }),
      )
      .default([]),
    rationale: z.string().optional(),
    evidence: z.array(z.string()).default([]),
    confidence: z.number().min(0).max(1).default(0.5),
  })
  .strict();

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
const SECTION_HEADINGS = Object.freeze({
  summary: ['summary', 'profile', 'professional summary', 'about'],
  skills: ['skills', 'technical skills', 'core competencies', 'technologies'],
  experience: [
    'experience',
    'work experience',
    'employment',
    'professional experience',
  ],
  education: ['education', 'academic background', 'qualifications'],
  projects: ['projects'],
});

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

  async execute(
    sources: readonly IngestionSource[],
    llmContext?: LLMRuntimeContext,
  ): Promise<readonly PartialCandidate[]> {
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

      for (const candidate of extractedCandidates) {
        const enrichedCandidate = await this.applyLlmRefinement(
          createPartialCandidate({
            ...candidate,
            sourceRecords: [sourceRecord],
            additionalData: Object.freeze({
              ...candidate.additionalData,
              __sourceEvidence: buildSourceEvidence(parsedContent),
            }),
          }),
          parsedContent,
          llmContext,
        );
        partialCandidates.push(enrichedCandidate);
      }

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

  private async applyLlmRefinement(
    candidate: PartialCandidate,
    parsedContent: unknown,
    llmContext?: LLMRuntimeContext,
  ): Promise<PartialCandidate> {
    if (!llmContext?.isEnabledFor('extraction')) {
      return candidate;
    }

    const response = await llmContext.orchestrator.runJson({
      stage: 'extraction',
      responseSchema: extractionRefinementSchema,
      input: {
        candidate,
        parsedContent,
      },
      prompt: [
        'Enrich the extracted candidate using only grounded source evidence.',
        'Prefer filling missing fields over changing existing ones.',
        'Never invent companies, dates, degrees, locations, or skills.',
        JSON.stringify({
          candidate,
          parsedContent,
        }),
      ].join('\n\n'),
    });

    if (!response.ok) {
      return candidate;
    }

    llmContext.recordDecision(response.envelope);

    return createPartialCandidate({
      ...candidate,
      headline: candidate.headline ?? response.data.headline,
      summary: candidate.summary ?? response.data.summary,
      location:
        candidate.location ??
        (response.data.location
          ? createLocation(response.data.location)
          : undefined),
      skills:
        candidate.skills.length > 0
          ? candidate.skills
          : response.data.skills.map((name) => createSkill({ name })),
      experiences:
        candidate.experiences.length > 0
          ? candidate.experiences
          : response.data.experiences.map((experience) =>
              createExperience({
                employer: experience.employer,
                title: experience.title,
                description: experience.description,
                startDate: experience.startDate,
                endDate: experience.endDate,
                isCurrent: experience.isCurrent ?? false,
              }),
            ),
      education:
        candidate.education.length > 0
          ? candidate.education
          : response.data.education.map((entry) =>
              createEducation({
                institution: entry.institution,
                degree: entry.degree,
                fieldOfStudy: entry.fieldOfStudy,
                startDate: entry.startDate,
                endDate: entry.endDate,
              }),
            ),
    });
  }
}

function buildSourceEvidence(
  parsedContent: ParsedContent,
): Readonly<Record<string, unknown>> {
  if (parsedContent.kind === 'text') {
    return Object.freeze({
      rawText: parsedContent.text,
      sections: buildTextSections(parsedContent),
    });
  }

  if (parsedContent.kind === 'csv') {
    return Object.freeze({
      rawText: JSON.stringify({
        headers: parsedContent.headers,
        rows: parsedContent.rows,
      }),
      sections: {
        record: JSON.stringify(parsedContent.rows),
      },
    });
  }

  return Object.freeze({
    rawText: JSON.stringify(parsedContent.data),
    sections: {
      record: JSON.stringify(parsedContent.data),
    },
  });
}

function buildTextSections(
  parsedContent: ParsedTextContent,
): Readonly<Record<string, string>> {
  const sections: Record<string, string> = {};

  for (const [sectionName, headings] of Object.entries(SECTION_HEADINGS)) {
    const section = headings
      .map((heading) => extractSection(parsedContent.text, heading))
      .find((value): value is string => Boolean(value));

    if (section) {
      sections[sectionName] = section;
    }
  }

  return Object.freeze(sections);
}

function extractSection(text: string, heading: string): string | undefined {
  const pattern = new RegExp(
    `${heading}\\s*[:\\n\\r]+([\\s\\S]*?)(?:\\n[A-Z][A-Z\\s]{2,}|$)`,
    'i',
  );
  return text.match(pattern)?.[1]?.trim();
}
