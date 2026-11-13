import { z } from 'zod';

const NAME_MAX_LENGTH = 100;
const COMPANY_NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;
const PASSWORD_MAX_BYTES = 72;

export const nameField = z.string().trim().min(1).max(NAME_MAX_LENGTH);

export const emailField = z.string().trim().toLowerCase().max(EMAIL_MAX_LENGTH).pipe(z.email());

const PASSWORD_MAX_BYTES_MESSAGE = `Password must be at most ${PASSWORD_MAX_BYTES} bytes`;

function fitsBcryptByteLimit(password) {
  return Buffer.byteLength(password, 'utf8') <= PASSWORD_MAX_BYTES;
}

export const passwordField = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .max(PASSWORD_MAX_LENGTH)
  .refine(fitsBcryptByteLimit, { message: PASSWORD_MAX_BYTES_MESSAGE });

const loginPasswordField = z
  .string()
  .min(1)
  .refine(fitsBcryptByteLimit, { message: PASSWORD_MAX_BYTES_MESSAGE });

export const signupSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordField,
  companyName: z.string().trim().min(1).max(COMPANY_NAME_MAX_LENGTH),
});

export const loginSchema = z.object({
  email: emailField,
  password: loginPasswordField,
});
