import { z } from 'zod';
import { emailField, nameField, passwordField } from './auth.schemas.js';

export const createUserSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordField,
});
