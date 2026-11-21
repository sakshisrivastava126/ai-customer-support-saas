import path from 'node:path';
import multer from 'multer';
import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const UPLOAD_FIELD_NAME = 'file';
const BYTES_PER_MB = 1024 * 1024;
const MAX_FILES_PER_REQUEST = 1;
const MAX_NON_FILE_FIELDS = 10;
const FILENAME_CHARSET = 'utf8';

const ALLOWED_MIME_TYPES_BY_EXTENSION = Object.freeze({
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
});

const ALLOWED_TYPES_LABEL = Object.keys(ALLOWED_MIME_TYPES_BY_EXTENSION).join(', ');

function unsupportedFileTypeError() {
  return new AppError(
    400,
    'UNSUPPORTED_FILE_TYPE',
    `Unsupported file type. Allowed types: ${ALLOWED_TYPES_LABEL}`,
  );
}

function fileRequiredError() {
  return new AppError(400, 'FILE_REQUIRED', `Upload exactly one file in the "${UPLOAD_FIELD_NAME}" field`);
}

function isAllowedFile(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  const expectedMimeType = ALLOWED_MIME_TYPES_BY_EXTENSION[extension];
  return expectedMimeType !== undefined && file.mimetype === expectedMimeType;
}

function fileFilter(req, file, callback) {
  if (isAllowedFile(file)) callback(null, true);
  else callback(unsupportedFileTypeError());
}

const multerUpload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: FILENAME_CHARSET,
  limits: {
    fileSize: config.maxUploadMb * BYTES_PER_MB,
    files: MAX_FILES_PER_REQUEST,
    fields: MAX_NON_FILE_FIELDS,
  },
  fileFilter,
}).single(UPLOAD_FIELD_NAME);

function toUploadError(err) {
  if (err instanceof AppError) return err;
  if (!(err instanceof multer.MulterError)) return err;
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError(413, 'FILE_TOO_LARGE', `File is larger than ${config.maxUploadMb} MB`);
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
    return fileRequiredError();
  }
  return new AppError(400, 'INVALID_UPLOAD', 'The upload could not be processed');
}

export function uploadSingleFile(req, res, next) {
  multerUpload(req, res, (err) => {
    if (err) return next(toUploadError(err));
    if (!req.file) return next(fileRequiredError());
    next();
  });
}
