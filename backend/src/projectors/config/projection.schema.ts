import { z } from 'zod';
import crypto from 'node:crypto';
import {
  projectionTargetSchema,
  uuidSchema,
} from '../../types/schemas/common.schema';

const fieldPathSchema = z.string().trim().min(1);
const fieldSpecSchema = z
  .object({
    path: fieldPathSchema,
    from: fieldPathSchema.optional(),
    type: z
      .enum(['string', 'string[]', 'number', 'boolean', 'object', 'object[]'])
      .optional(),
    required: z.boolean().optional(),
    normalize: z.enum(['E164', 'e164', 'canonical']).optional(),
  })
  .strict();
const fieldSelectionSchema = z.union([fieldPathSchema, fieldSpecSchema]);
const aliasSchema = z.record(fieldPathSchema, fieldPathSchema).default({});
const formattingSchema = z
  .object({
    array: z.enum(['preserve', 'comma-separated']).optional(),
    phone: z.enum(['raw', 'e164']).optional(),
    date: z.enum(['iso', 'mm/yyyy', 'yyyy']).optional(),
    location: z.enum(['readable', 'iso-country']).optional(),
    joinWith: z.string().min(1).optional(),
    normalize: z.enum(['E164', 'e164', 'canonical']).optional(),
  })
  .strict();

export const projectionConfigSchema = z
  .object({
    id: uuidSchema.optional(),
    target: projectionTargetSchema.default('api'),
    fields: z.array(fieldSelectionSchema).default([]),
    exclude: z.array(fieldPathSchema).default([]),
    rename: aliasSchema,
    computedFields: z.array(fieldPathSchema).default([]),
    missingValuePolicy: z.enum(['omit', 'null', 'error']).default('omit'),
    on_missing: z.enum(['omit', 'null', 'error']).optional(),
    formatting: z.record(fieldPathSchema, formattingSchema).default({}),
    includeConfidence: z.boolean().default(false),
    include_confidence: z.boolean().optional(),
    includeProvenance: z.boolean().default(false),
    include_provenance: z.boolean().optional(),
    includeSourceRecords: z.boolean().default(false),
    include_source_records: z.boolean().optional(),
    fieldAllowList: z.array(fieldPathSchema).optional(),
    fieldBlockList: z.array(fieldPathSchema).optional(),
    transforms: z.array(fieldPathSchema).optional(),
    includeNullishFields: z.boolean().optional(),
  })
  .strict()
  .transform((value) => ({
    id: value.id ?? crypto.randomUUID(),
    target: value.target,
    fields: value.fields.length > 0 ? value.fields : (value.fieldAllowList ?? []),
    exclude:
      value.exclude.length > 0 ? value.exclude : (value.fieldBlockList ?? []),
    rename: value.rename,
    computedFields:
      value.computedFields.length > 0
        ? value.computedFields
        : (value.transforms ?? []),
    missingValuePolicy:
      value.on_missing ??
      (value.includeNullishFields && value.missingValuePolicy === 'omit'
        ? 'null'
        : value.missingValuePolicy),
    formatting: value.formatting,
    includeConfidence: value.include_confidence ?? value.includeConfidence,
    includeProvenance: value.include_provenance ?? value.includeProvenance,
    includeSourceRecords: value.include_source_records ?? value.includeSourceRecords,
  }));
