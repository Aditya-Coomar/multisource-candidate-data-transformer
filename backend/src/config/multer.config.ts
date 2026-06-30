import path from 'node:path';
import multer from 'multer';
import { config } from './config';
import { UploadError } from '../errors';

type FileFilterFile = {
  originalname: string;
  mimetype: string;
};

type FileFilterCallback = (error: Error | null, acceptFile?: boolean) => void;

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.csv', '.json']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/json',
]);

const BLOCKED_HIDDEN_EXTENSION_PATTERN = /\.(pdf|docx|txt|csv|json)\./i;

function sanitizeFileName(fileName: string): string {
  return path
    .basename(fileName)
    .replace(/[^\w.\-()\s]/g, '_')
    .trim();
}

function hasUnsafeHiddenExtension(fileName: string): boolean {
  return BLOCKED_HIDDEN_EXTENSION_PATTERN.test(fileName);
}

function getFileExtension(fileName: string): string {
  return path.extname(fileName).toLowerCase();
}

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxUploadSizeBytes,
    files: config.upload.maxFiles,
  },
  fileFilter: (
    _req: unknown,
    file: FileFilterFile,
    callback: FileFilterCallback,
  ) => {
    const originalName = sanitizeFileName(file.originalname);
    const extension = getFileExtension(originalName);

    if (!originalName) {
      callback(
        new UploadError('File name is required.', {
          statusCode: 400,
          code: 'INVALID_UPLOAD',
        }),
      );
      return;
    }

    if (hasUnsafeHiddenExtension(originalName)) {
      callback(
        new UploadError('Hidden file extensions are not supported.', {
          statusCode: 415,
          code: 'UNSUPPORTED_MEDIA_TYPE',
          details: { fileName: originalName },
        }),
      );
      return;
    }

    if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(
        new UploadError('Unsupported file type.', {
          statusCode: 415,
          code: 'UNSUPPORTED_MEDIA_TYPE',
          details: {
            fileName: originalName,
            mimeType: file.mimetype,
            extension,
          },
        }),
      );
      return;
    }

    file.originalname = originalName;
    callback(null, true);
  },
});

export const supportedUploadExtensions = Object.freeze([...ALLOWED_EXTENSIONS]);
export const supportedUploadMimeTypes = Object.freeze([...ALLOWED_MIME_TYPES]);
