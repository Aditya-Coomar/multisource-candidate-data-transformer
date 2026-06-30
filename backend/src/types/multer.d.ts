declare module 'multer' {
  import type { RequestHandler } from 'express';

  export interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  }

  export interface FileFilterCallback {
    (error: Error | null, acceptFile?: boolean): void;
  }

  export interface Options {
    storage?: unknown;
    limits?: {
      fileSize?: number;
      files?: number;
    };
    fileFilter?: (
      req: unknown,
      file: MulterFile,
      callback: FileFilterCallback,
    ) => void;
  }

  export class MulterError extends Error {
    code: string;
    field?: string;
    constructor(code: string, field?: string);
  }

  export interface MulterInstance {
    array(fieldName: string, maxCount?: number): RequestHandler;
  }

  interface MulterStatic {
    (options?: Options): MulterInstance;
    memoryStorage(): unknown;
    MulterError: typeof MulterError;
  }

  const multer: MulterStatic;
  export default multer;
}
