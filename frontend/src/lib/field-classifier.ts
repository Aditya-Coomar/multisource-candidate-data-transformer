import { normalizeKey } from "./json";

export type FieldGroup =
  | "identity"
  | "contact"
  | "skills"
  | "experience"
  | "education"
  | "provenance"
  | "diagnostics"
  | "other";

const FIELD_GROUPS: Readonly<Record<FieldGroup, readonly string[]>> = {
  identity: [
    "candidateid",
    "fullname",
    "candidatename",
    "name",
    "headline",
    "yearsexperience",
    "overallexperience",
    "overallconfidence",
  ],
  contact: [
    "emails",
    "email",
    "primaryemail",
    "phones",
    "phone",
    "location",
    "links",
    "sociallinks",
    "linkedin",
    "github",
    "portfolio",
  ],
  skills: ["skills", "technicalskills", "tools", "competencies"],
  experience: ["experience", "experiences", "workhistory", "recentroles", "roles"],
  education: ["education", "schools", "academicbackground", "qualifications"],
  provenance: ["provenance", "sourcehistory", "fieldhistory", "lineage"],
  diagnostics: ["confidence", "llmdecisions", "semanticwarnings", "explanations"],
  other: [],
};

export function classifyField(key: string): FieldGroup {
  const normalized = normalizeKey(key);

  for (const [group, keys] of Object.entries(FIELD_GROUPS)) {
    if (keys.includes(normalized)) {
      return group as FieldGroup;
    }
  }

  if (normalized.endsWith("confidence")) {
    return "diagnostics";
  }

  return "other";
}

export function sortCandidateEntries<T>(
  entries: readonly (readonly [string, T])[],
): (readonly [string, T])[] {
  const order: FieldGroup[] = [
    "identity",
    "contact",
    "skills",
    "experience",
    "education",
    "provenance",
    "diagnostics",
    "other",
  ];

  return [...entries].sort(
    ([left], [right]) =>
      order.indexOf(classifyField(left)) - order.indexOf(classifyField(right)),
  );
}
