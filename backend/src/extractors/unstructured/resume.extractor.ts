import { createContactInfo } from '../../models/contact-info';
import { createEducation } from '../../models/education';
import { createExperience } from '../../models/experience';
import { createLocation } from '../../models/location';
import { createPartialCandidate } from '../../models/partial-candidate';
import { createSkill } from '../../models/skill';
import { createSocialLink } from '../../models/social-link';
import type { PartialCandidate } from '../../models/partial-candidate';
import type { Extractor } from '../base/extractor.interface';
import type { IngestionSource, ParsedContent, ParsedTextContent } from '../base/extractor.types';

const SECTION_HEADINGS = {
  summary: ['summary', 'profile', 'professional summary', 'about'],
  skills: ['skills', 'technical skills', 'core competencies', 'technologies'],
  experience: ['experience', 'work experience', 'professional experience', 'employment'],
  education: ['education', 'academic background', 'qualifications'],
  projects: ['projects'],
  clubs: ['clubs and communities', 'clubs', 'communities'],
  extra: ['extra-curricular', 'extracurricular', 'achievements'],
} as const;
const ALL_SECTION_HEADING_PATTERN = Object.values(SECTION_HEADINGS)
  .flat()
  .map(escapeRegExp)
  .join('|');

function getSection(text: string, headings: readonly string[]): string | undefined {
  for (const heading of headings) {
    const pattern = new RegExp(
      `(?:^|\\n)\\s*${escapeRegExp(heading)}\\s*[:\\n\\r]+([\\s\\S]*?)(?=\\n\\s*(?:${ALL_SECTION_HEADING_PATTERN})\\s*:?\\n|$)`,
      'i',
    );
    const match = text.match(pattern)?.[1]?.trim();
    if (match) {
      return match;
    }
  }

  return undefined;
}

function splitSkills(section: string | undefined): string[] {
  if (!section) {
    return [];
  }

  return section
    .split(/[,\n|;]+/)
    .flatMap((item) => item.split(/\s{2,}/))
    .map((item) =>
      item
        .replace(/^[-*]\s*/, '')
        .replace(/^(technical stack|tools|soft skills|languages)\s*:\s*/i, '')
        .trim(),
    )
    .filter((item) => item.length > 1 && !/^(skills?|tools?|languages?)$/i.test(item));
}

function unique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }

  return result;
}

function extractAll(pattern: RegExp, text: string): string[] {
  return unique([...text.matchAll(pattern)].map((match) => match[0].trim()));
}

function inferHeadline(lines: readonly string[], fullName: string | undefined): string | undefined {
  const firstSectionIndex = lines.findIndex(isSectionHeading);
  const headerLines = firstSectionIndex >= 0 ? lines.slice(0, firstSectionIndex) : lines;

  return headerLines.find((line, index) =>
    index > 0 &&
    line !== fullName &&
    line.length <= 120 &&
    !line.includes('@') &&
    !line.includes('⋄') &&
    !line.includes('◆') &&
    !/linkedin\.com|github\.com/i.test(line) &&
    !/^https?:\/\//i.test(line) &&
    !/\+?\d[\d\s().-]{7,}\d/.test(line) &&
    !isSectionHeading(line),
  );
}

function inferLocation(lines: readonly string[]): ReturnType<typeof createLocation> | undefined {
  const headerLines = lines.slice(0, Math.min(lines.length, 6));
  const locationLine =
    headerLines
      .flatMap((line) => line.split(/\s*[⋄◆]\s*/))
      .map((segment) => segment.trim())
      .find(isLikelyLocationSegment) ??
    lines.find((line) => /(?:location|address)\s*:/i.test(line));

  if (!locationLine) {
    return undefined;
  }

  const cleaned = locationLine.replace(/^(?:location|address)\s*:\s*/i, '');
  const [city, region, country] = cleaned.split(',').map((part) => part.trim()).filter(Boolean);

  return createLocation({
    raw: cleaned,
    city,
    region,
    country,
    formatted: cleaned,
  });
}

function extractExperienceLegacy(section: string | undefined) {
  if (!section) {
    return [];
  }

  const entries = section
    .split(/\n(?=\S.+(?:\bat\b|\||-).+)/i)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return entries
    .map((entry) => {
      const firstLine = entry.split(/\r?\n/)[0]?.replace(/^[-*]\s*/, '').trim();
      if (!firstLine) {
        return undefined;
      }

      const dateMatch = firstLine.match(
        /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4})\s*(?:-|to|–)\s*((?:Present|Current|Now)|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4})/i,
      );
      const withoutDates = dateMatch ? firstLine.replace(dateMatch[0], '').trim() : firstLine;
      const parts = withoutDates
        .split(/\s+(?:at|@)\s+|\s+[|]\s+|\s+-\s+/i)
        .map((part) => part.trim())
        .filter(Boolean);
      const title = parts.length > 1 ? parts[0] : undefined;
      const employer = parts.length > 1 ? parts.slice(1).join(' - ') : parts[0];

      if (!employer || employer.length > 120) {
        return undefined;
      }

      return createExperience({
        employer,
        title,
        startDate: dateMatch?.[1],
        endDate: /present|current|now/i.test(dateMatch?.[2] ?? '') ? undefined : dateMatch?.[2],
        isCurrent: /present|current|now/i.test(dateMatch?.[2] ?? ''),
        description: entry
          .split(/\r?\n/)
          .slice(1)
          .map((line) => line.replace(/^[-*]\s*/, '').trim())
          .filter(Boolean)
          .join(' '),
      });
    })
    .filter((entry): entry is ReturnType<typeof createExperience> => Boolean(entry));
}

type JobHeader = {
  readonly employer: string;
  readonly startDate: string;
  readonly endDate?: string;
  readonly isCurrent: boolean;
};

function extractExperience(section: string | undefined) {
  if (!section) {
    return [];
  }

  const jobs: ReturnType<typeof createExperience>[] = [];
  let current:
    | {
        header: JobHeader;
        detailLines: string[];
      }
    | undefined;

  for (const rawLine of section.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const header = parseJobHeader(line);
    if (header) {
      if (current) {
        jobs.push(buildExperience(current.header, current.detailLines));
      }

      current = {
        header,
        detailLines: [],
      };
      continue;
    }

    if (current) {
      current.detailLines.push(line);
    }
  }

  if (current) {
    jobs.push(buildExperience(current.header, current.detailLines));
  }

  return jobs.length > 0 ? jobs : extractExperienceLegacy(section);
}

function parseJobHeader(line: string): JobHeader | undefined {
  if (isBulletLine(line)) {
    return undefined;
  }

  const datePattern =
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4})\s*(?:-|to|–|—|â€“)\s*((?:Present|Current|Now)|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4})/i;
  const dateMatch = line.match(datePattern);

  if (!dateMatch) {
    const singleDatePattern =
      /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4})$/i;
    const singleDateMatch = line.match(singleDatePattern);

    if (!singleDateMatch) {
      return undefined;
    }

    const employer = line.slice(0, singleDateMatch.index).trim();

    if (!isLikelyEmployer(employer)) {
      return undefined;
    }

    return {
      employer,
      startDate: singleDateMatch[1]!,
      endDate: singleDateMatch[1]!,
      isCurrent: false,
    };
  }

  const employer = line.slice(0, dateMatch.index).trim();

  if (!isLikelyEmployer(employer)) {
    return undefined;
  }

  const endValue = dateMatch[2]!;
  const isCurrent = /present|current|now/i.test(endValue);

  return {
    employer,
    startDate: dateMatch[1]!,
    endDate: isCurrent ? undefined : endValue,
    isCurrent,
  };
}

function buildExperience(
  header: JobHeader,
  detailLines: readonly string[],
): ReturnType<typeof createExperience> {
  const titleLine = detailLines.find((line) => !isBulletLine(line));
  const bulletStartIndex = detailLines.findIndex(isBulletLine);
  const descriptionLines =
    bulletStartIndex >= 0
      ? detailLines.slice(bulletStartIndex)
      : detailLines.slice(titleLine ? 1 : 0);
  const titleAndLocation = parseTitleAndLocation(titleLine);

  return createExperience({
    employer: header.employer,
    title: titleAndLocation.title,
    startDate: header.startDate,
    endDate: header.endDate,
    isCurrent: header.isCurrent,
    location: titleAndLocation.location,
    description: normalizeDescription(descriptionLines),
  });
}

function parseTitleAndLocation(
  line: string | undefined,
): {
  readonly title?: string;
  readonly location?: ReturnType<typeof createLocation>;
} {
  if (!line || isBulletLine(line)) {
    return {};
  }

  if (line.includes(',')) {
    const [left, region, country] = line
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const leftTokens = left?.split(/\s+/).filter(Boolean) ?? [];

    if (leftTokens.length >= 2 && region) {
      const city = leftTokens[leftTokens.length - 1];
      const title = leftTokens.slice(0, -1).join(' ');
      const locationText = [city, region, country].filter(Boolean).join(', ');

      return {
        title,
        location: createLocation({
          raw: locationText,
          city,
          region,
          country,
          formatted: locationText,
        }),
      };
    }
  }

  const match = line.match(
    /^(.+?)\s+([A-Za-z .'-]+,\s*[A-Za-z .'-]+(?:,\s*[A-Za-z .'-]+)?|Remote|Hybrid)$/i,
  );
  if (!match) {
    return {
      title: line,
    };
  }

  const title = match[1]!.trim();
  const locationText = match[2]!.trim();

  if (/^(Remote|Hybrid)$/i.test(locationText)) {
    return {
      title,
    };
  }

  const [city, region, country] = locationText
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    title,
    location: createLocation({
      raw: locationText,
      city,
      region,
      country,
      formatted: locationText,
    }),
  };
}

function normalizeDescription(lines: readonly string[]): string | undefined {
  const description = lines
    .map((line) => line.replace(/^[•*-]\s*/, '').replace(/^â€¢\s*/, '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return description || undefined;
}

function isBulletLine(line: string): boolean {
  return /^[•*-]\s+/.test(line) || /^â€¢\s*/.test(line);
}

function isLikelyEmployer(value: string): boolean {
  return (
    value.length > 1 &&
    value.length <= 120 &&
    !isBulletLine(value) &&
    !/[.!?]$/.test(value) &&
    !/^(shipped|and|low-|needs|users|export|design|worked|gained|developed|built|optimized|researched|collaborated)\b/i.test(value)
  );
}

function isLikelyLocationSegment(value: string): boolean {
  return (
    /^[A-Za-z .'-]+,\s*[A-Za-z .'-]+(?:,\s*[A-Za-z .'-]+)?$/.test(value) &&
    !/^\+?\d/.test(value) &&
    !/@|linkedin\.com|github\.com/i.test(value)
  );
}

function isSectionHeading(line: string): boolean {
  return Object.values(SECTION_HEADINGS)
    .flat()
    .some((heading) => heading.toLowerCase() === line.toLowerCase());
}

function extractEducation(section: string | undefined) {
  if (!section) {
    return [];
  }

  return section
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => {
      if (/^gpa\s*:/i.test(line)) {
        return undefined;
      }

      const year = line.match(/\b(19|20)\d{2}\b/)?.[0];
      const [degreePart, institutionPart] = line
        .split(',')
        .map((part) => part.trim());
      const degreeMatch = degreePart?.match(/\b(Ph\.?\s*D\.?|M\.?\s*S\.?|M\.?\s*Tech|M\.?\s*B\.?\s*A\.?|B\.?\s*S\.?|B\.?\s*Tech|B\.?\s*E\.?|Bachelor[^,|-]*|Master[^,|-]*|Diploma[^,|-]*)/i)?.[0];
      const institution = (institutionPart ?? '')
        .replace(/\bExpected\b/i, '')
        .replace(year ?? '', '')
        .replace(/[|-]+/g, ' ')
        .trim();
      const fieldOfStudy = degreePart
        ?.replace(degreeMatch ?? '', '')
        .replace(/^\s+in\s+/i, '')
        .trim();

      if (!institution && !degreeMatch) {
        return undefined;
      }

      return createEducation({
        institution: institution || degreeMatch || 'Unknown Institution',
        degree: degreeMatch,
        fieldOfStudy,
        endDate: year ? `${year}-01` : undefined,
      });
    })
    .filter((entry): entry is ReturnType<typeof createEducation> => Boolean(entry));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class ResumeExtractor implements Extractor<ParsedTextContent> {
  public readonly name = 'ResumeExtractor';

  supports(source: IngestionSource, parsedContent: ParsedContent): boolean {
    return (
      parsedContent.kind === 'text' &&
      (source.sourceType === 'resume' || source.fileName.toLowerCase().includes('resume'))
    );
  }

  async extract(parsedContent: ParsedTextContent): Promise<readonly PartialCandidate[]> {
    const text = parsedContent.text;
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const fullName = lines.find((line) => line.length <= 80 && /^[A-Za-z][A-Za-z .'-]+$/.test(line));
    const emails = extractAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, text);
    const phones = extractAll(/(?:\+?\d[\d\s().-]{7,}\d)/g, text);
    const urls = extractAll(
      /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|gitlab\.com|bitbucket\.org|[\w.-]+\.[A-Za-z]{2,})\/[^\s),]+/gi,
      text,
    ).map((url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`));
    const summary =
      getSection(text, SECTION_HEADINGS.summary);
    const skills = splitSkills(
      getSection(text, SECTION_HEADINGS.skills),
    );
    const experience = extractExperience(getSection(text, SECTION_HEADINGS.experience));
    const education = extractEducation(getSection(text, SECTION_HEADINGS.education));

    return [
      createPartialCandidate({
        fullName,
        headline: inferHeadline(lines, fullName),
        summary,
        location: inferLocation(lines),
        contactInfo: [
          ...emails.map((value, index) =>
            createContactInfo({ kind: 'email', value, isPrimary: index === 0 }),
          ),
          ...phones.map((value, index) =>
            createContactInfo({
              kind: 'phone',
              value,
              isPrimary: emails.length === 0 && index === 0,
            }),
          ),
        ],
        socialLinks: urls.map((url) =>
          createSocialLink({
            platform: url.includes('linkedin.com')
              ? 'linkedin'
              : url.includes('github.com')
                ? 'github'
                : 'portfolio',
            url,
          }),
        ),
        experiences: experience,
        education,
        skills: unique(skills).map((name) => createSkill({ name })),
      }),
    ];
  }
}
