import { z } from 'zod';
import {
  projectionTargetSchema,
  uuidSchema,
} from '../../types/schemas/common.schema';

const fieldPathSchema = z.string().trim().min(1);
const aliasSchema = z.record(fieldPathSchema, fieldPathSchema).default({});
const formattingSchema = z
  .object({
    array: z.enum(['preserve', 'comma-separated']).optional(),
    phone: z.enum(['raw', 'e164']).optional(),
    date: z.enum(['iso', 'mm/yyyy', 'yyyy']).optional(),
    location: z.enum(['readable', 'iso-country']).optional(),
    joinWith: z.string().min(1).optional(),
  })
  .strict();

export const projectionConfigSchema = z
  .object({
    id: uuidSchema,
    target: projectionTargetSchema.default('api'),
    fields: z.array(fieldPathSchema).default([]),
    exclude: z.array(fieldPathSchema).default([]),
    rename: aliasSchema,
    computedFields: z.array(fieldPathSchema).default([]),
    missingValuePolicy: z.enum(['omit', 'null', 'error']).default('omit'),
    formatting: z.record(fieldPathSchema, formattingSchema).default({}),
    includeConfidence: z.boolean().default(false),
    includeProvenance: z.boolean().default(false),
    includeSourceRecords: z.boolean().default(false),
    fieldAllowList: z.array(fieldPathSchema).optional(),
    fieldBlockList: z.array(fieldPathSchema).optional(),
    transforms: z.array(fieldPathSchema).optional(),
    includeNullishFields: z.boolean().optional(),
  })
  .strict()
  .transform((value) => ({
    id: value.id,
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
      value.includeNullishFields && value.missingValuePolicy === 'omit'
        ? 'null'
        : value.missingValuePolicy,
    formatting: value.formatting,
    includeConfidence: value.includeConfidence,
    includeProvenance: value.includeProvenance,
    includeSourceRecords: value.includeSourceRecords,
  }));
