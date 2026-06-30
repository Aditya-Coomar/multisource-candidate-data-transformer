import { z } from 'zod';
import {
  metadataSchema,
  sourceTypeSchema,
  uuidSchema,
} from './common.schema';

export const sourceRecordSchema = z
  .object({
    id: uuidSchema,
    sourceId: z.string().min(1),
    sourceType: sourceTypeSchema,
    sourceName: z.string().min(1),
    fileName: z.string().min(1),
    mimeType: z.string().min(1),
    receivedAt: z.string().datetime({ offset: true }),
    parser: z.string().min(1),
    extractor: z.string().min(1),
    metadata: metadataSchema,
  })
  .passthrough();
