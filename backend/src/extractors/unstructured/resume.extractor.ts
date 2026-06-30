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
} as const;

function getSection(text: string, headings: readonly string[]): string | undefined {
  for (const heading of headings) {
  const pattern = new RegExp(
      `(?:^|\\n)\\s*${escapeRegExp(heading)}\\s*[:\\n\\r]+([\\s\\S]*?)(?=\\n\\s*[A-Z][A-Z\\s/&-]{2,}\\s*:?\\n|$)`,
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
    .map((item) => item.replace(/^[-*]\s*/, '').trim())
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
  return lines.find((line, index) =>
    index > 0 &&
    line !== fullName &&
    line.length <= 120 &&
    !line.includes('@') &&
    !/^https?:\/\//i.test(line) &&
    !/^\+?\d[\d\s().-]{7,}\d$/.test(line) &&
    !Object.values(SECTION_HEADINGS).flat().some((heading) => heading.toLowerCase() === line.toLowerCase()),
  );
}

function inferLocation(lines: readonly string[]): ReturnType<typeof createLocation> | undefined {
  const locationLine = lines.find((line) =>
    /(?:location|address)\s*:/i.test(line) ||
    /^[A-Za-z .'-]+,\s*[A-Za-z .'-]+(?:,\s*[A-Za-z .'-]+)?$/.test(line),
  );

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

function extractExperience(section: string | undefined) {
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

function extractEducation(section: string | undefined) {
  if (!section) {
    return [];
  }

  return section
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const year = line.match(/\b(19|20)\d{2}\b/)?.[0];
      const degreeMatch = line.match(/\b(Ph\.?D\.?|M\.?S\.?|M\.?Tech|M\.?B\.?A\.?|B\.?S\.?|B\.?Tech|B\.?E\.?|Bachelor[^,|-]*|Master[^,|-]*|Diploma[^,|-]*)/i)?.[0];
      const institution = line
        .replace(degreeMatch ?? '', '')
        .replace(year ?? '', '')
        .replace(/[|,-]+/g, ' ')
        .trim();

      if (!institution && !degreeMatch) {
        return undefined;
      }

      return createEducation({
        institution: institution || degreeMatch || 'Unknown Institution',
        degree: degreeMatch,
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
    const urls = extractAll(/https?:\/\/[^\s),]+/gi, text);
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
