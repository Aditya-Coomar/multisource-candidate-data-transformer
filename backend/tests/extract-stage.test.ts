import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnsupportedSourceError } from '../src/errors';
import { ExtractorFactory } from '../src/extractors/base/extractor.factory';
import type { IngestionSource } from '../src/extractors/base/extractor.types';
import { ParserFactory } from '../src/parsers/parser.factory';
import { CsvParser } from '../src/parsers/csv.parser';
import { DocxParser } from '../src/parsers/docx.parser';
import { JsonParser } from '../src/parsers/json.parser';
import { PdfParser } from '../src/parsers/pdf.parser';
import { TextParser } from '../src/parsers/text.parser';
import { ExtractStage } from '../src/pipeline/stages/extract.stage';

const pdfParseMockState = vi.hoisted(() => ({
  getText: vi.fn(),
  destroy: vi.fn(),
  constructorArgs: [] as unknown[],
}));

vi.mock('pdf-parse', () => ({
  PDFParse: class {
    constructor(options: unknown) {
      pdfParseMockState.constructorArgs.push(options);
    }

    getText() {
      return pdfParseMockState.getText();
    }

    destroy() {
      return pdfParseMockState.destroy();
    }
  },
}));

function createSource(
  overrides: Partial<IngestionSource> & Pick<IngestionSource, 'fileName' | 'mimeType'>,
): IngestionSource {
  const buffer = overrides.buffer ?? Buffer.from('sample');

  return {
    sourceId: overrides.sourceId ?? randomUUID(),
    sourceName: overrides.sourceName ?? 'Test Source',
    sourceType: overrides.sourceType ?? 'other',
    fileName: overrides.fileName,
    mimeType: overrides.mimeType,
    buffer,
    size: overrides.size ?? buffer.length,
    receivedAt: overrides.receivedAt ?? '2026-06-30T00:00:00.000Z',
  };
}

describe('Phase 3 extraction pipeline', () => {
  beforeEach(() => {
    pdfParseMockState.constructorArgs.length = 0;
    pdfParseMockState.getText.mockReset();
    pdfParseMockState.destroy.mockReset();
    pdfParseMockState.destroy.mockResolvedValue(undefined);
  });

  it('parser factory resolves the correct parser by source', () => {
    const factory = new ParserFactory();

    expect(factory.resolve(createSource({
      fileName: 'candidates.csv',
      mimeType: 'text/csv',
    }))).toBeInstanceOf(CsvParser);
    expect(factory.resolve(createSource({
      fileName: 'candidate.json',
      mimeType: 'application/json',
      sourceType: 'ats',
    }))).toBeInstanceOf(JsonParser);
    expect(factory.resolve(createSource({
      fileName: 'resume.pdf',
      mimeType: 'application/pdf',
    }))).toBeInstanceOf(PdfParser);
    expect(factory.resolve(createSource({
      fileName: 'resume.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }))).toBeInstanceOf(DocxParser);
    expect(factory.resolve(createSource({
      fileName: 'notes.txt',
      mimeType: 'text/plain',
    }))).toBeInstanceOf(TextParser);
  });

  it('extractor factory resolves structured and unstructured extractors', async () => {
    const factory = new ExtractorFactory();
    const csvSource = createSource({
      fileName: 'candidates.csv',
      mimeType: 'text/csv',
      sourceType: 'job-board',
    });
    const csvExtractor = factory.resolve(csvSource, {
      kind: 'csv',
      headers: ['name'],
      rows: [{ name: 'Jane Doe' }],
      rowCount: 1,
    });

    expect(csvExtractor.name).toBe('CsvExtractor');

    const resumeSource = createSource({
      fileName: 'resume.txt',
      mimeType: 'text/plain',
      sourceType: 'resume',
    });
    const resumeExtractor = factory.resolve(resumeSource, {
      kind: 'text',
      text: 'Jane Doe\nEmail: jane@example.com',
    });

    expect(resumeExtractor.name).toBe('ResumeExtractor');
  });

  it('csv parser rejects duplicate headers', async () => {
    const parser = new CsvParser();

    await expect(
      parser.parse(
        createSource({
          fileName: 'duplicate.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from('name,name\nJane,Doe'),
        }),
      ),
    ).rejects.toThrow('duplicate headers');
  });

  it('json parser rejects malformed input', async () => {
    const parser = new JsonParser();

    await expect(
      parser.parse(
        createSource({
          fileName: 'broken.json',
          mimeType: 'application/json',
          buffer: Buffer.from('{broken'),
        }),
      ),
    ).rejects.toThrow('malformed');
  });

  it('text parser supports UTF-16 input', async () => {
    const parser = new TextParser();
    const buffer = Buffer.from('\ufeffName: Jane Doe', 'utf16le');

    const parsed = await parser.parse(
      createSource({
        fileName: 'notes.txt',
        mimeType: 'text/plain',
        buffer,
      }),
    );

    expect(parsed.text).toContain('Jane Doe');
  });

  it('pdf parser uses the installed PDFParse API shape', async () => {
    const parser = new PdfParser();
    pdfParseMockState.getText.mockResolvedValue({
      text: 'Jane Doe\nTypeScript',
    });

    const parsed = await parser.parse(
      createSource({
        fileName: 'resume.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 fake'),
      }),
    );

    expect(parsed.text).toContain('Jane Doe');
    expect(pdfParseMockState.constructorArgs).toHaveLength(1);
    expect(pdfParseMockState.getText).toHaveBeenCalledTimes(1);
    expect(pdfParseMockState.destroy).toHaveBeenCalledTimes(1);
  });

  it('extract stage processes resume and csv sources into partial candidates', async () => {
    const stage = new ExtractStage();

    const results = await stage.execute([
      createSource({
        fileName: 'resume.txt',
        mimeType: 'text/plain',
        sourceType: 'resume',
        sourceName: 'Resume Upload',
        buffer: Buffer.from(
          [
            'Jane Doe',
            'Senior Backend Engineer',
            'jane@example.com',
            '+1 555 111 2222',
            'https://github.com/janedoe',
            'SKILLS',
            'TypeScript, Node.js, PostgreSQL',
          ].join('\n'),
        ),
      }),
      createSource({
        fileName: 'candidates.csv',
        mimeType: 'text/csv',
        sourceType: 'job-board',
        sourceName: 'CSV Upload',
        buffer: Buffer.from(
          'full_name,email,phone,skills\nJohn Smith,john@example.com,+1 555 333 4444,"JavaScript;React"',
        ),
      }),
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]?.sourceRecords[0]?.parser).toBe('TextParser');
    expect(results[0]?.sourceRecords[0]?.extractor).toBe('ResumeExtractor');
    expect(results[0]?.contactInfo[0]?.value).toBe('jane@example.com');
    expect(results[1]?.sourceRecords[0]?.parser).toBe('CsvParser');
    expect(results[1]?.skills.map((skill) => skill.name)).toEqual([
      'JavaScript',
      'React',
    ]);
  });

  it('keeps resume experience bullets attached to the correct job instead of treating them as employers', async () => {
    const stage = new ExtractStage();

    const [candidate] = await stage.execute([
      createSource({
        fileName: 'aditya-resume.txt',
        mimeType: 'text/plain',
        sourceType: 'resume',
        sourceName: 'Resume Upload',
        buffer: Buffer.from(
          [
            'ADITYA COOMAR',
            '+91 79035 50110 ⋄ Chennai, Tamil Nadu',
            'adi.coomar04@gmail.com ⋄ linkedin.com/in/aditya-coomar ⋄ github.com/Aditya-Coomar',
            'EDUCATION',
            'B. Tech in Computer Science and Engineering, SRM Institute of Science and Technology Expected 2027',
            'GPA: 9.85',
            'SKILLS',
            'Technical Stack: React.js, Next.js, TypeScript, Node.js',
            'Tools: Docker, Git/GitHub, Postman',
            'WORK EXPERIENCE',
            'Bajaj Finserv Health Limited June 2025 - Aug 2025',
            'SDE Intern Pune, Mahrashtra, India',
            '- Built and delivered a production-ready Visitor Management System.',
            '- Optimized frontend performance and added image compression.',
            'Reflow Technologies Sept 2024 - April 2025',
            'Web Development Hybrid',
            '- Worked with a team of 3 to develop a User Dashboard.',
            'IBM Oct 2021',
            'Intern Remote',
            '- Gained comprehensive insights into product development.',
            'PROJECTS',
            'Campus Web',
          ].join('\n'),
        ),
      }),
    ]);

    expect(candidate?.headline).toBeUndefined();
    expect(candidate?.location?.city).toBe('Chennai');
    expect(candidate?.socialLinks.map((link) => link.platform)).toEqual([
      'linkedin',
      'github',
    ]);
    expect(candidate?.skills.map((skill) => skill.name)).toEqual([
      'React.js',
      'Next.js',
      'TypeScript',
      'Node.js',
      'Docker',
      'Git/GitHub',
      'Postman',
    ]);
    expect(candidate?.experiences.map((experience) => experience.employer)).toEqual([
      'Bajaj Finserv Health Limited',
      'Reflow Technologies',
      'IBM',
    ]);
    expect(candidate?.experiences[0]?.title).toBe('SDE Intern');
    expect(candidate?.experiences[0]?.description).toContain(
      'Built and delivered a production-ready Visitor Management System.',
    );
    expect(candidate?.experiences[0]?.description).toContain(
      'Optimized frontend performance',
    );
    expect(candidate?.education).toHaveLength(1);
    expect(candidate?.education[0]).toMatchObject({
      institution: 'SRM Institute of Science and Technology',
      degree: 'B. Tech',
      fieldOfStudy: 'Computer Science and Engineering',
      endDate: '2027-01',
    });
  });

  it('extract stage processes ATS JSON sources', async () => {
    const stage = new ExtractStage();

    const results = await stage.execute([
      createSource({
        fileName: 'ats.json',
        mimeType: 'application/json',
        sourceType: 'ats',
        buffer: Buffer.from(
          JSON.stringify({
            candidates: [
              {
                firstName: 'Ava',
                lastName: 'Patel',
                email: 'ava@example.com',
                skills: ['Python', 'SQL'],
              },
            ],
          }),
        ),
      }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]?.fullName).toBe('Ava Patel');
    expect(results[0]?.sourceRecords[0]?.extractor).toBe('AtsJsonExtractor');
  });

  it('extract stage processes recruiter notes', async () => {
    const stage = new ExtractStage();

    const results = await stage.execute([
      createSource({
        fileName: 'recruiter-notes.txt',
        mimeType: 'text/plain',
        sourceType: 'manual',
        buffer: Buffer.from(
          'Name: Maria Chen\nEmail: maria@example.com\nSkills: Go;Kubernetes\nNotes: Strong systems background',
        ),
      }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]?.fullName).toBe('Maria Chen');
    expect(results[0]?.sourceRecords[0]?.extractor).toBe(
      'RecruiterNotesExtractor',
    );
  });

  it('rejects unsupported archive and media sources', async () => {
    const stage = new ExtractStage();

    await expect(
      stage.execute([
        createSource({
          fileName: 'bundle.zip',
          mimeType: 'application/zip',
        }),
      ]),
    ).rejects.toBeInstanceOf(UnsupportedSourceError);

    await expect(
      stage.execute([
        createSource({
          fileName: 'preview.mp4',
          mimeType: 'video/mp4',
        }),
      ]),
    ).rejects.toBeInstanceOf(UnsupportedSourceError);
  });

  it('rejects hidden extensions and empty sources', async () => {
    const stage = new ExtractStage();

    await expect(
      stage.execute([
        createSource({
          fileName: 'resume.pdf.exe',
          mimeType: 'application/x-msdownload',
        }),
      ]),
    ).rejects.toBeInstanceOf(UnsupportedSourceError);

    await expect(
      stage.execute([
        createSource({
          fileName: 'empty.txt',
          mimeType: 'text/plain',
          buffer: Buffer.alloc(0),
          size: 0,
        }),
      ]),
    ).rejects.toThrow('empty');
  });
});
